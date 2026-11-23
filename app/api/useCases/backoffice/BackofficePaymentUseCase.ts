import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { PaymentMethodUnavailableError, assertBillingTypeAllowed } from "@/lib/payment-methods/availability"
import { markedUnavailableOutput } from "@/lib/payment-methods/route-guard"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import { createRoutedProviderCharge } from "@/lib/payment-provider/routed-charge"
import { IBackofficePaymentRepository } from "../../infra/data/repositories/backoffice/PaymentRepository/IBackofficePaymentRepository"
import { IBackofficeClientRepository } from "../../infra/data/repositories/backoffice/ClientRepository/IBackofficeClientRepository"

export interface CreatePaymentInput {
  clientId: string
  billingType?: string
  amount: number
  dueDate?: string // ISO string
  description?: string
  /** CPF ou CNPJ do cliente, exigido pelo provedor; salvo no cadastro quando o cliente não tinha. */
  cpfCnpj?: string
  /** Token de uso único gerado no navegador pelo abacatepay.js (nunca dados do cartão). */
  cardToken?: string
}

const DEFAULT_DUE_DAYS = 7
const ABACATE_PROVIDER = "ABACATE_PAY"
const BILLING_TYPES_NEW_CHARGES = new Set(["PIX", "CREDIT_CARD"])

const digitsOnly = (value: string) => value.replace(/\D/g, "")
const isValidDocument = (digits: string) => digits.length === 11 || digits.length === 14

const failure = (message: string) => new Output(false, [], [message], null)

export class BackofficePaymentUseCase {
  constructor(
    private paymentRepo: IBackofficePaymentRepository,
    private clientRepo: IBackofficeClientRepository,
    private charge: typeof createRoutedProviderCharge = createRoutedProviderCharge,
    private assertCardAllowed: (billingType: string) => Promise<void> = (billingType) =>
      assertBillingTypeAllowed(billingType)
  ) {}

  async createPayment(data: CreatePaymentInput, createdByProfileId: string): Promise<Output> {
    try {
      if (!data.clientId) {
        return failure("Cliente é obrigatório")
      }
      if (!data.amount || data.amount <= 0) {
        return failure("Valor deve ser maior que zero")
      }

      const billingType = data.billingType ?? "PIX"
      if (!BILLING_TYPES_NEW_CHARGES.has(billingType)) {
        return failure("Boleto não está disponível para novas cobranças")
      }

      const client = await this.clientRepo.findById(data.clientId)
      if (!client) {
        return failure("Cliente não encontrado")
      }

      const taxId = digitsOnly(data.cpfCnpj ?? client.cpfCnpj ?? "")
      if (!isValidDocument(taxId)) {
        return failure("Informe um CPF ou CNPJ válido para o cliente")
      }
      if (!client.email) {
        return failure("Cadastre o e-mail do cliente antes de cobrar")
      }
      // A AbacatePay recusa cliente sem celular; sem esta checagem o operador só veria "Erro ao criar cobrança".
      if (!digitsOnly(client.phone ?? "")) {
        return failure("Cadastre o telefone do cliente antes de cobrar")
      }

      if (billingType === "CREDIT_CARD") {
        await this.assertCardAllowed(billingType)
        if (!data.cardToken) {
          return failure("Confirme os dados do cartão antes de cobrar")
        }
      }

      if (!client.cpfCnpj) {
        await this.clientRepo.updateCpfCnpj(client.id, taxId)
      }

      const id = randomUUID()
      const amountInCents = Math.round(data.amount * 100)
      const charged = await this.charge({
        ownerType: PAYMENT_PROVIDER_OWNER_TYPES.BACKOFFICE_PAYMENT,
        ownerId: id,
        tenantId: client.id,
        idempotencyKey: `backoffice-payment-${id}`,
        routeVersion: "BACKOFFICE-PAYMENT-PHASE-1",
        billingType: billingType as "PIX" | "CREDIT_CARD",
        amountInCents,
        externalReference: `backoffice-payment-${id}`,
        customer: {
          name: client.fullName,
          email: client.email,
          taxId,
          cellphone: digitsOnly(client.phone ?? ""),
        },
        metadata: { backofficePaymentId: id },
        cardToken: data.cardToken,
        installments: 1,
      })

      const providerResult = charged.outcome
      const pix = "pix" in providerResult && providerResult.pix ? providerResult.pix : null
      const status =
        providerResult.status === "CONFIRMED" ? "RECEIVED" : providerResult.status === "FAILED" ? "FAILED" : "PENDING"
      const dueDate = data.dueDate
        ? new Date(data.dueDate)
        : new Date(Date.now() + DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000)

      const payment = await this.paymentRepo.create({
        id,
        clientId: data.clientId,
        billingType,
        amount: data.amount,
        dueDate,
        description: data.description,
        provider: ABACATE_PROVIDER,
        status,
        invoiceUrl: pix && charged.attempt.externalId ? `https://pay.abacate.app/invoice/${charged.attempt.externalId}` : undefined,
        // O provedor devolve o PNG já com prefixo data:; a tela monta o prefixo, então guardamos só o base64.
        pixQrCode: pix?.brCodeBase64?.replace(/^data:image\/png;base64,/, ""),
        pixPayload: pix?.brCode,
        createdByProfileId,
      })

      if (status === "FAILED") {
        return failure("Cartão recusado pelo provedor")
      }
      return new Output(true, ["Cobrança criada com sucesso"], [], payment)
    } catch (error) {
      if (error instanceof PaymentMethodUnavailableError) return markedUnavailableOutput(error)
      console.error("[BackofficePaymentUseCase][createPayment]", error)
      return failure("Erro ao criar cobrança")
    }
  }

  async listPayments(clientId?: string): Promise<Output> {
    try {
      const payments = await this.paymentRepo.findMany(clientId ? { clientId } : undefined)
      return new Output(true, [], [], payments)
    } catch (error) {
      console.error("[BackofficePaymentUseCase][listPayments]", error)
      return new Output(false, [], ["Erro ao listar cobranças"], null)
    }
  }

  async getPaymentById(id: string): Promise<Output> {
    try {
      const payment = await this.paymentRepo.findById(id)
      if (!payment) {
        return new Output(false, [], ["Cobrança não encontrada"], null)
      }
      return new Output(true, [], [], payment)
    } catch (error) {
      console.error("[BackofficePaymentUseCase][getPaymentById]", error)
      return new Output(false, [], ["Erro ao buscar cobrança"], null)
    }
  }
}
