import type { BackofficeAdhesionStatus } from "@prisma/client"
import { Output } from "@/lib/output"
import {
  backofficeAdhesionService,
  BackofficeAdhesionService,
} from "@/app/api/services/backofficeAdhesion/BackofficeAdhesionService"
import type {
  BackofficeAdhesionCheckoutInput,
  BackofficeAdhesionCreateInput,
  BackofficeAdhesionPaymentWebhookInput,
  BackofficeAdhesionUpdateInput,
  IBackofficeAdhesionService,
} from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import type { IBackofficeAdhesionUseCase } from "./IBackofficeAdhesionUseCase"

export const BACKOFFICE_ADHESION_STATUS_VALUES = [
  "pending",
  "paid",
  "overdue",
  "expired",
  "canceled",
] as const

export type BackofficeAdhesionStatusValue = (typeof BACKOFFICE_ADHESION_STATUS_VALUES)[number]

export function isBackofficeAdhesionStatusValue(
  value: unknown
): value is BackofficeAdhesionStatusValue {
  return (
    typeof value === "string" &&
    (BACKOFFICE_ADHESION_STATUS_VALUES as readonly string[]).includes(value)
  )
}

const EXPECTED_CREATE_ERROR_MESSAGES = new Set([
  "Lead não está elegível para nova adesão",
  "Lead já possui uma adesão vinculada",
  "Já existe uma conta cadastrada com este e-mail",
  "Nome completo deve ter pelo menos 2 caracteres",
  "Celular deve conter 10 ou 11 dígitos",
  "E-mail inválido",
  "CPF/CNPJ inválido",
  "E-mail é obrigatório para pagamento por fora",
  "Convite só pode ser reenviado para adesões pagas",
  "Adesão paga sem e-mail para reenvio de convite",
  "Adesão paga sem e-mail para envio de convite",
])

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isExpectedCreateError(error: unknown): boolean {
  return error instanceof Error && EXPECTED_CREATE_ERROR_MESSAGES.has(error.message)
}

export class BackofficeAdhesionUseCase implements IBackofficeAdhesionUseCase {
  constructor(
    private readonly service: IBackofficeAdhesionService = new BackofficeAdhesionService()
  ) {}

  async list(input: {
    page: number
    pageSize: number
    status?: BackofficeAdhesionStatus
    query?: string
  }): Promise<Output> {
    try {
      const result = await this.service.list(input)
      return new Output(true, ["Adesões listadas com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar adesões"], null)
    }
  }

  async getOptions(): Promise<Output> {
    try {
      const result = await this.service.getOptions()
      return new Output(true, ["Opções de adesão carregadas com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][getOptions]", error)
      return new Output(false, [], ["Erro ao carregar opções de adesão"], null)
    }
  }

  async create(
    input: BackofficeAdhesionCreateInput,
    createdByBackofficeUserId: string | null
  ): Promise<Output> {
    try {
      const result = await this.service.create(input, createdByBackofficeUserId)
      return new Output(true, ["Nova adesão gerada com sucesso"], [], result)
    } catch (error) {
      if (!isExpectedCreateError(error)) {
        console.error("[BackofficeAdhesionUseCase][create]", error)
      }
      return new Output(
        false,
        [],
        [getErrorMessage(error, "Erro ao gerar adesão")],
        null
      )
    }
  }

  async update(id: string, input: BackofficeAdhesionUpdateInput): Promise<Output> {
    try {
      const result = await this.service.update(id, input)
      return new Output(true, ["Adesão atualizada com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][update]", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao atualizar adesão"],
        null
      )
    }
  }

  async resend(id: string): Promise<Output> {
    try {
      const result = await this.service.resend(id)
      return new Output(true, ["Link de adesão gerado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][resend]", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao reenviar adesão"],
        null
      )
    }
  }

  async resendInvite(id: string): Promise<Output> {
    try {
      const result = await this.service.resendInvite(id)
      return new Output(true, ["Convite reenviado com sucesso"], [], result)
    } catch (error) {
      if (!isExpectedCreateError(error)) {
        console.error("[BackofficeAdhesionUseCase][resendInvite]", error)
      }
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao reenviar convite"],
        null
      )
    }
  }

  async getPublicDetails(token: string): Promise<Output> {
    try {
      const result = await this.service.getPublicDetails(token)
      if ("tokenStatus" in result) {
        return new Output(false, [], [`Token inválido: ${result.tokenStatus}`], result)
      }
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][getPublicDetails]", error)
      return new Output(false, [], ["Erro ao carregar adesão"], null)
    }
  }

  async createCheckout(
    token: string,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<Output> {
    try {
      const result = await this.service.createCheckout(token, input)
      if ("tokenStatus" in result) {
        return new Output(false, [], [`Token inválido: ${result.tokenStatus}`], result)
      }
      return new Output(true, ["Pagamento gerado com sucesso"], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][createCheckout]", error)
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao gerar pagamento"],
        null
      )
    }
  }

  async getPaymentStatus(token: string, options?: { sync?: boolean }): Promise<Output> {
    try {
      const result = await this.service.getPaymentStatus(token, options)
      if ("tokenStatus" in result) {
        return new Output(false, [], [`Token inválido: ${result.tokenStatus}`], result)
      }
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][getPaymentStatus]", error)
      return new Output(false, [], ["Erro ao verificar pagamento"], null)
    }
  }

  async processPaymentWebhook(
    event: string,
    payment: BackofficeAdhesionPaymentWebhookInput
  ): Promise<Output> {
    try {
      const result = await this.service.processPaymentWebhook(event, payment)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficeAdhesionUseCase][processPaymentWebhook]", error)
      return new Output(false, [], ["Erro ao processar webhook de adesão"], null)
    }
  }
}

export const backofficeAdhesionUseCase = new BackofficeAdhesionUseCase(
  backofficeAdhesionService
)
