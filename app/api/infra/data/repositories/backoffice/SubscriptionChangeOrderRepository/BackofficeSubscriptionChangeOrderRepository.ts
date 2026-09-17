import { prisma } from "@/app/api/infra/data/prisma"
import type { AsaasAccount, Prisma } from "@prisma/client"
import { toBillingCycle } from "@/lib/billing/resolvePrice"
import type {
  AttachSubscriptionChangeOrderPaymentData,
  BackofficeSubscriptionChangeOrderRecord,
  ChangeOrderMasterContext,
  ChangeOrderTargetProduct,
  CreateBackofficeSubscriptionChangeOrderData,
  IBackofficeSubscriptionChangeOrderRepository,
  LogSubscriptionChangeOrderEventData,
} from "./IBackofficeSubscriptionChangeOrderRepository"

const CHANGE_ORDER_SELECT = {
  id: true,
  masterProfileId: true,
  status: true,
  targetProductId: true,
  targetProduct: { select: { name: true } },
  targetCycle: true,
  listAmount: true,
  proratedAmount: true,
  overrideAmount: true,
  overrideStatus: true,
  overrideApprovedByProfileId: true,
  chargeAmount: true,
  asaasPaymentId: true,
  asaasAccount: true,
  paymentInvoiceUrl: true,
  createdAt: true,
} satisfies Prisma.BackofficeSubscriptionChangeOrderSelect

type ChangeOrderQueryResult = Prisma.BackofficeSubscriptionChangeOrderGetPayload<{
  select: typeof CHANGE_ORDER_SELECT
}>

function decimalToNumber(value: { toString(): string } | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

type CurrentProductPrices = {
  priceMonthly: Prisma.Decimal | null
  priceQuarterly: Prisma.Decimal | null
  priceQuadrimester: Prisma.Decimal | null
  priceSemiannual: Prisma.Decimal | null
  priceAnnual: Prisma.Decimal | null
}

/**
 * Achado codex/cursor[bot] no PR #1167: sem isto, um master legado (ciclo +
 * vencimento sem adesão vinculada) ou qualquer master após a 1ª ordem
 * aplicada (G3 zera `adhesionId` de propósito) ficava com
 * `currentChargedAmount = null` → `?? 0` na pró-rata → cobra o valor cheio
 * do alvo sem abater o que já se paga hoje. Fallback: preço de TABELA do
 * produto atual no ciclo atual — mesmo padrão de `getProductListAmountForCycle`
 * do E5/UseCase, duplicado aqui de propósito (repositórios não importam de
 * useCases).
 */
function getCurrentProductListAmountForCycle(
  product: CurrentProductPrices,
  cycle: string
): number | null {
  switch (cycle) {
    case "monthly":
      return decimalToNumber(product.priceMonthly)
    case "quarterly":
      return decimalToNumber(product.priceQuarterly)
    case "quadrimester":
      return decimalToNumber(product.priceQuadrimester)
    case "semiannual":
      return decimalToNumber(product.priceSemiannual)
    case "annual":
      return decimalToNumber(product.priceAnnual)
    default:
      return null
  }
}

/**
 * Reverso de `toBillingCycle` (lib/billing/resolvePrice.ts) — o texto
 * canônico gravado em `ProfileSubscription.subscriptionCycle` pelo resto do
 * sistema (sync de webhook, etc.) é maiúsculo no vocabulário do Asaas.
 */
const LEGACY_CYCLE_LABEL: Record<string, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  quadrimester: "QUADRIMESTER",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
}

/**
 * Achado cursor[bot] no PR #1167 (rodada 2): pagar a diferença de UMA
 * alteração de plano não quita o que causou suspended/past_due, nem deve
 * reverter canceled. `applyEntitlement` não promove para "active" a partir
 * destes.
 */
const BLOCKED_ENTITLEMENT_PROMOTION_STATUSES = new Set(["suspended", "past_due", "canceled"])

function mapRecord(order: ChangeOrderQueryResult): BackofficeSubscriptionChangeOrderRecord {
  return {
    id: order.id,
    masterProfileId: order.masterProfileId,
    status: order.status as BackofficeSubscriptionChangeOrderRecord["status"],
    targetProductId: order.targetProductId,
    targetProductName: order.targetProduct.name,
    targetCycle: order.targetCycle,
    listAmount: Number(order.listAmount.toString()),
    proratedAmount: Number(order.proratedAmount.toString()),
    overrideAmount: decimalToNumber(order.overrideAmount),
    overrideStatus: order.overrideStatus as BackofficeSubscriptionChangeOrderRecord["overrideStatus"],
    overrideApprovedByProfileId: order.overrideApprovedByProfileId,
    chargeAmount: Number(order.chargeAmount.toString()),
    asaasPaymentId: order.asaasPaymentId,
    asaasAccount: order.asaasAccount,
    paymentInvoiceUrl: order.paymentInvoiceUrl,
    createdAt: order.createdAt,
  }
}

export class BackofficeSubscriptionChangeOrderRepository implements IBackofficeSubscriptionChangeOrderRepository {
  async findMasterContext(masterProfileId: string): Promise<ChangeOrderMasterContext | null> {
    const master = await prisma.profile.findFirst({
      where: { id: masterProfileId, isMaster: true, role: "manager" },
      select: {
        id: true,
        fullName: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        asaasCustomerId: true,
        asaasCustomerAccount: true,
        hasPermanentSubscription: true,
        subscription: {
          select: {
            productId: true,
            subscriptionCycle: true,
            subscriptionStatus: true,
            subscriptionNextDueDate: true,
            adhesion: { select: { cycle: true, totalAmount: true, negotiatedTotalAmount: true } },
            product: {
              select: {
                priceMonthly: true,
                priceQuarterly: true,
                priceQuadrimester: true,
                priceSemiannual: true,
                priceAnnual: true,
              },
            },
          },
        },
      },
    })

    if (!master) return null

    const subscription = master.subscription
    const currentCycle =
      subscription?.adhesion?.cycle ?? toBillingCycle(subscription?.subscriptionCycle ?? "") ?? null
    const currentChargedAmount = subscription?.adhesion
      ? decimalToNumber(subscription.adhesion.negotiatedTotalAmount ?? subscription.adhesion.totalAmount)
      : currentCycle && subscription?.product
        ? getCurrentProductListAmountForCycle(subscription.product, currentCycle)
        : null

    return {
      hasPermanentSubscription: master.hasPermanentSubscription,
      currentProductId: subscription?.productId ?? null,
      currentCycle,
      currentChargedAmount,
      currentSubscriptionStatus: subscription?.subscriptionStatus ?? null,
      currentPeriodEnd: subscription?.subscriptionNextDueDate ?? null,
      billingProfile: {
        id: master.id,
        fullName: master.fullName,
        email: master.email,
        cpfCnpj: master.cpfCnpj,
        phone: master.phone,
        postalCode: master.postalCode,
        address: master.address,
        addressNumber: master.addressNumber,
        neighborhood: master.neighborhood,
        complement: master.complement,
        asaasCustomerId: master.asaasCustomerId,
        asaasCustomerAccount: master.asaasCustomerAccount,
      },
    }
  }

  async findTargetProduct(productId: string): Promise<ChangeOrderTargetProduct | null> {
    const product = await prisma.backofficeProduct.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        isActive: true,
        priceMonthly: true,
        priceQuarterly: true,
        priceQuadrimester: true,
        priceSemiannual: true,
        priceAnnual: true,
      },
    })

    if (!product) return null

    return {
      id: product.id,
      name: product.name,
      isActive: product.isActive,
      priceMonthly: decimalToNumber(product.priceMonthly),
      priceQuarterly: decimalToNumber(product.priceQuarterly),
      priceQuadrimester: decimalToNumber(product.priceQuadrimester),
      priceSemiannual: decimalToNumber(product.priceSemiannual),
      priceAnnual: decimalToNumber(product.priceAnnual),
    }
  }

  async create(
    data: CreateBackofficeSubscriptionChangeOrderData
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const created = await prisma.backofficeSubscriptionChangeOrder.create({
      data: {
        masterProfileId: data.masterProfileId,
        status: "draft",
        currentProductId: data.currentProductId,
        currentCycle: data.currentCycle ?? undefined,
        currentChargedAmount: data.currentChargedAmount,
        currentPeriodEnd: data.currentPeriodEnd,
        targetProductId: data.targetProductId,
        targetCycle: data.targetCycle,
        listAmount: data.listAmount,
        proratedAmount: data.proratedAmount,
        overrideAmount: data.overrideAmount,
        overrideStatus: data.overrideStatus,
        overrideApprovedByProfileId: data.overrideApprovedByProfileId,
        overrideApprovedAt: data.overrideApprovedAt,
        chargeAmount: data.chargeAmount,
        createdByBackofficeUserId: data.createdByBackofficeUserId,
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(created)
  }

  async findById(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
    const order = await prisma.backofficeSubscriptionChangeOrder.findUnique({
      where: { id },
      select: CHANGE_ORDER_SELECT,
    })

    return order ? mapRecord(order) : null
  }

  /**
   * Achado cursor[bot]/codex no PR #1167: até aqui, `chargeAmount` MUST
   * permanecer a pró-rata (nunca o avulso não aprovado) — só a aprovação
   * promove. Lê `overrideAmount` antes do UPDATE porque o query builder do
   * Prisma não copia coluna→coluna declarativamente.
   */
  async approveOverride(
    id: string,
    approverProfileId: string
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const current = await prisma.backofficeSubscriptionChangeOrder.findUniqueOrThrow({
      where: { id },
      select: { overrideAmount: true },
    })

    const updated = await prisma.backofficeSubscriptionChangeOrder.update({
      where: { id },
      data: {
        overrideStatus: "approved",
        overrideApprovedByProfileId: approverProfileId,
        overrideApprovedAt: new Date(),
        chargeAmount: current.overrideAmount ?? undefined,
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(updated)
  }

  async updateMasterAsaasCustomer(masterProfileId: string, customerId: string): Promise<void> {
    await prisma.profile.update({
      where: { id: masterProfileId },
      data: { asaasCustomerId: customerId, asaasCustomerAccount: "primary" satisfies AsaasAccount },
    })
  }

  async attachPayment(
    id: string,
    data: AttachSubscriptionChangeOrderPaymentData
  ): Promise<BackofficeSubscriptionChangeOrderRecord> {
    const updated = await prisma.backofficeSubscriptionChangeOrder.update({
      where: { id },
      data: {
        status: "awaiting_payment",
        asaasPaymentId: data.asaasPaymentId,
        asaasAccount: data.asaasAccount,
        paymentInvoiceUrl: data.paymentInvoiceUrl,
      },
      select: CHANGE_ORDER_SELECT,
    })

    return mapRecord(updated)
  }

  /**
   * G3: `updateMany` com `WHERE status = 'awaiting_payment'` é a trava de
   * concorrência real — se duas entregas do mesmo webhook chegarem juntas
   * (retry do Asaas), só uma tem `count === 1` e aplica o entitlement; a
   * outra vê `count === 0` e devolve `null` sem tocar em nada (idempotência
   * de fato, não por convenção de app).
   */
  async applyChangeOrder(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.backofficeSubscriptionChangeOrder.updateMany({
        where: { id, status: "awaiting_payment" },
        data: { status: "applied", appliedAt: new Date() },
      })

      if (claim.count === 0) {
        return null
      }

      const order = await tx.backofficeSubscriptionChangeOrder.findUniqueOrThrow({
        where: { id },
        select: CHANGE_ORDER_SELECT,
      })

      await this.applyEntitlement(tx, order)

      return mapRecord(order)
    })
  }

  /**
   * Achado cursor[bot] no PR #1167 (rodada 2): `generatePayment` sempre
   * postava no Asaas mesmo com `chargeAmount === 0` (downgrade/sem
   * diferença) — Asaas rejeita `value <= 0`. Mesma trava de concorrência de
   * `applyChangeOrder` (`updateMany` como lock real), partindo de `draft`
   * em vez de `awaiting_payment` — nunca existe cobrança para este caminho.
   */
  async applyFreeChangeOrder(id: string): Promise<BackofficeSubscriptionChangeOrderRecord | null> {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.backofficeSubscriptionChangeOrder.updateMany({
        where: { id, status: "draft", chargeAmount: 0 },
        data: { status: "applied", appliedAt: new Date() },
      })

      if (claim.count === 0) {
        return null
      }

      const order = await tx.backofficeSubscriptionChangeOrder.findUniqueOrThrow({
        where: { id },
        select: CHANGE_ORDER_SELECT,
      })

      await this.applyEntitlement(tx, order)

      return mapRecord(order)
    })
  }

  private async applyEntitlement(tx: Prisma.TransactionClient, order: ChangeOrderQueryResult): Promise<void> {
    const legacyCycle = LEGACY_CYCLE_LABEL[order.targetCycle] ?? order.targetCycle

    const current = await tx.profileSubscription.findUnique({
      where: { profileId: order.masterProfileId },
      select: { subscriptionStatus: true },
    })
    const shouldPromoteToActive =
      !current?.subscriptionStatus || !BLOCKED_ENTITLEMENT_PROMOTION_STATUSES.has(current.subscriptionStatus)

    // adhesionId: null — a assinatura passa a ser governada por esta
    // ordem, não pela adesão histórica (que teria produto/ciclo velhos e
    // sobrescreveria o que acabamos de aplicar na leitura de E5/§7.7).
    // Trade-off aceito: chargedAmount de E5 (que só lê de `adhesion`)
    // fica null após uma alteração via backoffice até uma iteração
    // futura ensinar `mapPlanSubscription` a também ler
    // `BackofficeSubscriptionChangeOrder.chargeAmount` — documentado
    // como gap conhecido, não regressão silenciosa.
    await tx.profileSubscription.upsert({
      where: { profileId: order.masterProfileId },
      update: {
        productId: order.targetProductId,
        subscriptionCycle: legacyCycle,
        ...(shouldPromoteToActive ? { subscriptionStatus: "active" as const } : {}),
        adhesionId: null,
      },
      create: {
        profileId: order.masterProfileId,
        productId: order.targetProductId,
        subscriptionCycle: legacyCycle,
        subscriptionStatus: "active",
      },
    })
  }

  /**
   * Achado codex/cursor[bot] no PR #1167: timeline própria do módulo — nunca
   * `logSubscriptionChange`/`SubscriptionChangeLog` (tabela do produto,
   * violaria Backoffice Module Isolation em agents.md). `eventType` reusa só
   * o TIPO `SubscriptionLifecycleEvent` do Prisma, preservando a semântica
   * tipada do G4 sem acoplar ao módulo produto.
   */
  async logEvent(data: LogSubscriptionChangeOrderEventData): Promise<void> {
    try {
      await prisma.backofficeSubscriptionChangeOrderEvent.create({
        data: {
          changeOrderId: data.changeOrderId,
          changeType: data.changeType,
          eventType: data.eventType ?? undefined,
          actorProfileId: data.actorProfileId ?? undefined,
          payload: data.payload as Prisma.InputJsonValue | undefined,
        },
      })
    } catch (error) {
      console.error("[BackofficeSubscriptionChangeOrderRepository][logEvent]", {
        changeOrderId: data.changeOrderId,
        changeType: data.changeType,
        error,
      })
    }
  }
}

export const backofficeSubscriptionChangeOrderRepository = new BackofficeSubscriptionChangeOrderRepository()
