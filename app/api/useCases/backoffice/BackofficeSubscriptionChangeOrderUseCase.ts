import { Output } from "@/lib/output"
import type { BackofficeAdhesionBillingCycle } from "@prisma/client"
import { createAsaasClient, type AsaasAccountId } from "@/lib/asaas"
import { calculateSubscriptionChangeProration } from "@/lib/billing/subscription-change-proration"
import { logSubscriptionChange } from "@/lib/billing/logSubscriptionChange"
import { asaasCustomerGateway as defaultAsaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway"
import type { IAsaasCustomerGateway } from "@/app/api/infra/gateways/asaasCustomer/IAsaasCustomerGateway"
import { emailService as defaultEmailService } from "@/lib/services/EmailService"
import type {
  BackofficeSubscriptionChangeOrderOverrideStatus,
  ChangeOrderTargetProduct,
  IBackofficeSubscriptionChangeOrderRepository,
} from "@/app/api/infra/data/repositories/backoffice/SubscriptionChangeOrderRepository/IBackofficeSubscriptionChangeOrderRepository"
import { backofficeSubscriptionChangeOrderRepository } from "@/app/api/infra/data/repositories/backoffice/SubscriptionChangeOrderRepository/BackofficeSubscriptionChangeOrderRepository"

type AsaasClientLike = {
  endpoints: { customers: string; payments: string }
  request(endpoint: string, options?: RequestInit): Promise<any>
}

type EmailServiceLike = {
  sendSubscriptionChangeOrderPaymentEmail(data: {
    masterName: string
    masterEmail: string
    targetProductName: string
    targetCycleLabel: string
    chargeAmount: number
    invoiceUrl: string
  }): Promise<unknown>
}

const BILLING_CYCLE_LABEL_PT: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  quadrimester: "Quadrimestral",
  semiannual: "Semestral",
  annual: "Anual",
}

/**
 * Teto do preço avulso auto-aprovável (S7/DA6) — [[90 — Decisões em
 * aberto (owner)]] D13 ainda não decidida. Default seguro: 0 (nenhum
 * preço avulso auto-aprova; toda operação exige `requireManagerAccess`
 * na rota de aprovação). Ajustável por env quando D13 for respondida —
 * mesmo padrão de ADHESION_DISCOUNT_AUTO_APPROVE_MAX_PERCENT.
 */
export const SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT = Number(
  process.env.BACKOFFICE_SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT ?? "0"
)

function getProductListAmountForCycle(
  product: ChangeOrderTargetProduct,
  cycle: BackofficeAdhesionBillingCycle
): number | null {
  switch (cycle) {
    case "monthly":
      return product.priceMonthly
    case "quarterly":
      return product.priceQuarterly
    case "quadrimester":
      return product.priceQuadrimester
    case "semiannual":
      return product.priceSemiannual
    case "annual":
      return product.priceAnnual
    default:
      return null
  }
}

export class BackofficeSubscriptionChangeOrderUseCase {
  constructor(
    private readonly repository: IBackofficeSubscriptionChangeOrderRepository = backofficeSubscriptionChangeOrderRepository,
    private readonly asaasClientFactory: (account: AsaasAccountId) => AsaasClientLike = (account) =>
      createAsaasClient(account),
    private readonly asaasCustomerGateway: IAsaasCustomerGateway = defaultAsaasCustomerGateway,
    private readonly emailService: EmailServiceLike = defaultEmailService
  ) {}

  /**
   * G1: cria a ordem de alteração em `draft`. Pró-rata **sempre** calculada
   * aqui, no servidor — o input não aceita um valor de pró-rata vindo do
   * chamador (mesmo princípio do `chargeAmount` do checkout, Diagnóstico
   * §12.3). Preço avulso (`overrideAmount`) passa pela trava S7/DA6.
   */
  async create(input: {
    masterProfileId: string
    targetProductId: string
    targetCycle: BackofficeAdhesionBillingCycle
    overrideAmount: number | null
    actorProfileId: string
    backofficeUserId: string | null
  }): Promise<Output> {
    try {
      const master = await this.repository.findMasterContext(input.masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }
      if (master.hasPermanentSubscription) {
        return new Output(
          false,
          [],
          ["Perfil com assinatura vitalícia não usa alteração de assinatura paga"],
          null
        )
      }

      const targetProduct = await this.repository.findTargetProduct(input.targetProductId)
      if (!targetProduct || !targetProduct.isActive) {
        return new Output(false, [], ["Produto alvo não encontrado ou inativo"], null)
      }

      const listAmount = getProductListAmountForCycle(targetProduct, input.targetCycle)
      if (listAmount === null) {
        return new Output(
          false,
          [],
          ["Produto alvo não tem preço configurado para o ciclo informado"],
          null
        )
      }

      const now = new Date()
      const proratedAmount = calculateSubscriptionChangeProration({
        currentChargedAmount: master.currentChargedAmount ?? 0,
        currentCycle: master.currentCycle,
        currentPeriodEnd: master.currentPeriodEnd,
        targetListAmount: listAmount,
        targetCycle: input.targetCycle,
        now,
      })

      let overrideStatus: BackofficeSubscriptionChangeOrderOverrideStatus = "not_required"
      let overrideApprovedByProfileId: string | null = null
      let overrideApprovedAt: Date | null = null
      let chargeAmount = proratedAmount

      if (input.overrideAmount !== null) {
        if (!Number.isFinite(input.overrideAmount) || input.overrideAmount <= 0) {
          return new Output(false, [], ["Preço avulso deve ser maior que zero"], null)
        }

        chargeAmount = input.overrideAmount
        const delta = Math.abs(input.overrideAmount - proratedAmount)

        if (delta <= SUBSCRIPTION_CHANGE_ORDER_OVERRIDE_AUTO_APPROVE_MAX_AMOUNT) {
          overrideStatus = "approved"
          overrideApprovedByProfileId = input.actorProfileId
          overrideApprovedAt = now
        } else {
          overrideStatus = "pending"
        }
      }

      const created = await this.repository.create({
        masterProfileId: input.masterProfileId,
        currentProductId: master.currentProductId,
        currentCycle: master.currentCycle,
        currentChargedAmount: master.currentChargedAmount,
        currentPeriodEnd: master.currentPeriodEnd,
        targetProductId: targetProduct.id,
        targetCycle: input.targetCycle,
        listAmount,
        proratedAmount,
        overrideAmount: input.overrideAmount,
        overrideStatus,
        overrideApprovedByProfileId,
        overrideApprovedAt,
        chargeAmount,
        createdByBackofficeUserId: input.backofficeUserId,
      })

      await logSubscriptionChange({
        profileId: input.masterProfileId,
        source: "backoffice_subscription_change_order",
        actorProfileId: input.actorProfileId,
        changeType: "subscription_change_order_created",
        after: {
          id: created.id,
          targetProductId: created.targetProductId,
          targetCycle: created.targetCycle,
          chargeAmount: created.chargeAmount,
          overrideStatus: created.overrideStatus,
        },
      })

      const message =
        overrideStatus === "pending"
          ? "Ordem criada — preço avulso acima do teto aguardando aprovação"
          : "Ordem de alteração de assinatura criada"

      return new Output(true, [message], [], created)
    } catch (error) {
      console.error("[BackofficeSubscriptionChangeOrderUseCase][create]", error)
      return new Output(false, [], ["Erro ao criar ordem de alteração de assinatura"], null)
    }
  }

  /** G1 (trava S7): manager aprova preço avulso acima do teto. */
  async approveOverride(id: string, approverProfileId: string): Promise<Output> {
    try {
      const order = await this.repository.findById(id)
      if (!order) {
        return new Output(false, [], ["Ordem não encontrada"], null)
      }
      if (order.overrideStatus !== "pending") {
        return new Output(false, [], ["Ordem não tem preço avulso pendente de aprovação"], null)
      }

      const approved = await this.repository.approveOverride(id, approverProfileId)

      await logSubscriptionChange({
        profileId: approved.masterProfileId,
        source: "backoffice_subscription_change_order",
        actorProfileId: approverProfileId,
        changeType: "subscription_change_order_override_approved",
        after: { id: approved.id, chargeAmount: approved.chargeAmount },
      })

      return new Output(true, ["Preço avulso aprovado"], [], approved)
    } catch (error) {
      console.error("[BackofficeSubscriptionChangeOrderUseCase][approveOverride]", error)
      return new Output(false, [], ["Erro ao aprovar preço avulso"], null)
    }
  }

  /**
   * G2: gera a cobrança da diferença — **sempre na conta nova** (DA6/§3.2 da
   * auditoria), nunca na legada, e envia e-mail nosso (Resend) — nunca
   * notificação do Asaas (customer nasce com `notificationDisabled`, mesmo
   * princípio de DA5/AsaasCustomerGateway). Ação explícita e separada de
   * `create`/`approveOverride`: nenhuma chamada ao Asaas acontece como
   * efeito colateral de outra operação.
   */
  async generatePayment(id: string): Promise<Output> {
    try {
      const order = await this.repository.findById(id)
      if (!order) {
        return new Output(false, [], ["Ordem não encontrada"], null)
      }
      if (order.status !== "draft") {
        return new Output(
          false,
          [],
          ["Ordem não está em draft — cobrança já foi gerada ou a ordem foi encerrada"],
          null
        )
      }
      if (order.overrideStatus === "pending") {
        return new Output(
          false,
          [],
          ["Preço avulso pendente de aprovação — aprove antes de gerar a cobrança"],
          null
        )
      }

      const master = await this.repository.findMasterContext(order.masterProfileId)
      if (!master) {
        return new Output(false, [], ["Usuário master não encontrado"], null)
      }

      const customerId = await this.ensurePrimaryCustomer(master.billingProfile)
      const client = this.asaasClientFactory("primary")

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      const cycleLabel = BILLING_CYCLE_LABEL_PT[order.targetCycle] ?? order.targetCycle

      const payment = await client.request(client.endpoints.payments, {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: order.chargeAmount,
          dueDate: dueDate.toISOString().slice(0, 10),
          description: `Alteração de assinatura — ${order.targetProductName} (${cycleLabel})`,
          externalReference: `subscription-change-order-${order.id}`,
        }),
      })

      if (!payment?.id) {
        return new Output(false, [], ["Não foi possível gerar a cobrança no Asaas"], null)
      }

      const updated = await this.repository.attachPayment(order.id, {
        asaasPaymentId: payment.id,
        asaasAccount: "primary",
        paymentInvoiceUrl: payment.invoiceUrl ?? null,
      })

      await this.emailService.sendSubscriptionChangeOrderPaymentEmail({
        masterName: master.billingProfile.fullName ?? master.billingProfile.email,
        masterEmail: master.billingProfile.email,
        targetProductName: order.targetProductName,
        targetCycleLabel: cycleLabel,
        chargeAmount: order.chargeAmount,
        invoiceUrl: payment.invoiceUrl ?? "",
      })

      await logSubscriptionChange({
        profileId: order.masterProfileId,
        source: "backoffice_subscription_change_order",
        changeType: "subscription_change_order_payment_generated",
        after: { id: updated.id, asaasPaymentId: updated.asaasPaymentId, status: updated.status },
      })

      return new Output(true, ["Cobrança gerada e e-mail enviado"], [], updated)
    } catch (error) {
      console.error("[BackofficeSubscriptionChangeOrderUseCase][generatePayment]", error)
      return new Output(false, [], ["Erro ao gerar a cobrança da alteração de assinatura"], null)
    }
  }

  /**
   * DA6: a cobrança nasce sempre na conta nova. Reusa o customer só quando
   * ele já existe NAQUELA conta (verificado via GET, nunca assumido) — GET
   * que falha é passo de migração explícito, não recriação automática
   * (mesmo invariante de `IncrementalBillingService.ensureCustomer`).
   */
  private async ensurePrimaryCustomer(billingProfile: {
    id: string
    fullName: string | null
    email: string
    cpfCnpj: string | null
    phone: string | null
    postalCode: string | null
    address: string | null
    addressNumber: string | null
    neighborhood: string | null
    complement: string | null
    asaasCustomerId: string | null
    asaasCustomerAccount: AsaasAccountId
  }): Promise<string> {
    if (billingProfile.asaasCustomerId && billingProfile.asaasCustomerAccount === "primary") {
      const client = this.asaasClientFactory("primary")
      await client.request(`${client.endpoints.customers}/${billingProfile.asaasCustomerId}`, {
        method: "GET",
      })
      return billingProfile.asaasCustomerId
    }

    const created = await this.asaasCustomerGateway.createCustomer({
      profileId: billingProfile.id,
      name: billingProfile.fullName ?? billingProfile.email,
      email: billingProfile.email,
      cpfCnpj: billingProfile.cpfCnpj ?? undefined,
      phone: billingProfile.phone ?? undefined,
      postalCode: billingProfile.postalCode ?? undefined,
      address: billingProfile.address ?? undefined,
      addressNumber: billingProfile.addressNumber ?? undefined,
      complement: billingProfile.complement ?? undefined,
      province: billingProfile.neighborhood ?? undefined,
    })

    await this.repository.updateMasterAsaasCustomer(billingProfile.id, created.id)
    return created.id
  }
}

export const backofficeSubscriptionChangeOrderUseCase = new BackofficeSubscriptionChangeOrderUseCase()
