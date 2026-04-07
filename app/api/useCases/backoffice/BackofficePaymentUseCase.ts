import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { asaasFetch, asaasApi } from "@/lib/asaas"
import type { IBackofficePaymentRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficePaymentRepository"
import type { IBackofficeClientRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeClientRepository"

export interface CreatePaymentInput {
  clientId: string
  billingType?: string
  amount: number
  dueDate?: string // ISO string
  description?: string
}

export class BackofficePaymentUseCase {
  constructor(
    private paymentRepo: IBackofficePaymentRepository,
    private clientRepo: IBackofficeClientRepository
  ) {}

  async createPayment(data: CreatePaymentInput, createdByProfileId: string): Promise<Output> {
    try {
      if (!data.clientId) {
        return new Output(false, [], ["Cliente é obrigatório"], null)
      }
      if (!data.amount || data.amount <= 0) {
        return new Output(false, [], ["Valor deve ser maior que zero"], null)
      }

      const client = await this.clientRepo.findById(data.clientId)
      if (!client) {
        return new Output(false, [], ["Cliente não encontrado"], null)
      }
      if (!client.asaasCustomerId) {
        return new Output(
          false,
          [],
          ["Cliente não possui integração Asaas. Crie o cliente com CPF/CNPJ para gerar cobranças."],
          null
        )
      }

      const billingType = data.billingType ?? "PIX"
      const id = randomUUID()

      // Criar cobrança no Asaas
      const asaasPayload = {
        customer: client.asaasCustomerId,
        billingType,
        value: data.amount,
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString().split("T")[0]
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        description: data.description,
        externalReference: id,
      }

      const asaasPayment = await asaasFetch(asaasApi.payments, {
        method: "POST",
        body: JSON.stringify(asaasPayload),
      })

      let pixQrCode: string | undefined
      let pixPayload: string | undefined

      // Buscar QR Code PIX se for pagamento PIX
      if (billingType === "PIX" && asaasPayment.id) {
        try {
          const pixData = await asaasFetch(asaasApi.pixQrCode(asaasPayment.id))
          pixQrCode = pixData.encodedImage
          pixPayload = pixData.payload
        } catch (pixError) {
          console.error("[BackofficePaymentUseCase] Erro ao buscar QR PIX:", pixError)
        }
      }

      const payment = await this.paymentRepo.create({
        id,
        clientId: data.clientId,
        billingType,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        description: data.description,
        asaasPaymentId: asaasPayment.id,
        invoiceUrl: asaasPayment.invoiceUrl,
        pixQrCode,
        pixPayload,
        createdByProfileId,
      })

      return new Output(true, ["Cobrança criada com sucesso"], [], payment)
    } catch (error) {
      console.error("[BackofficePaymentUseCase][createPayment]", error)
      return new Output(false, [], ["Erro ao criar cobrança"], null)
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
