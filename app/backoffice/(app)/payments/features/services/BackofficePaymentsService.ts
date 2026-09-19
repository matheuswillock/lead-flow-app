import type {
  IBackofficePaymentsService,
  BackofficePaymentItem,
  CreatePaymentFormData,
} from "./IBackofficePaymentsService"
import type { BackofficeClientItem } from "./IBackofficePaymentsService"
import { API_CLIENT_BASE } from "@/lib/route-map";
import { ApiRequestError } from "@/lib/http/api-request-error";

interface OutputResponse<T> {
  isValid: boolean
  successMessages?: string[]
  errorMessages?: string[]
  result?: T
}

/**
 * Estende `ApiRequestError` de propósito: `toUserToastMessage` só repassa a
 * mensagem intacta quando `isApiRequestError(error)` é true. Herdando de
 * `Error` puro, a copy de produto caía na heurística de acento/marcador e
 * mensagem legítima sem acento virava "Ocorreu um erro." — medido nas rotas
 * reais de payments: `Acesso negado` (403 do `getBackofficeAccess`) e
 * `Valor deve ser maior que zero` (400 do UseCase). Numa tela de dinheiro,
 * trocar falha silenciosa por falha vaga não é conserto.
 */
export class BackofficePaymentsRequestError extends ApiRequestError {
  readonly isValidationError: boolean

  constructor(message: string, status: number, isValidationError: boolean) {
    super(message, status)
    this.name = "BackofficePaymentsRequestError"
    this.isValidationError = isValidationError
  }
}

async function parseOutput<T>(response: Response): Promise<T> {
  let data: OutputResponse<T>
  try {
    data = (await response.json()) as OutputResponse<T>
  } catch {
    throw new BackofficePaymentsRequestError(
      "Resposta inesperada do servidor",
      response.status,
      false
    )
  }
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new BackofficePaymentsRequestError(
      data.errorMessages?.[0] ?? "Erro ao processar cobrança",
      response.status,
      response.status >= 400 && response.status < 500
    )
  }
  return data.result
}

export class BackofficePaymentsService implements IBackofficePaymentsService {
  async list(clientId?: string): Promise<BackofficePaymentItem[]> {
    const url = clientId
      ? `${API_CLIENT_BASE}/backoffice/payments?clientId=${clientId}`
      : `${API_CLIENT_BASE}/backoffice/payments`
    const res = await fetch(url, { cache: "no-store" })
    return parseOutput<BackofficePaymentItem[]>(res)
  }

  async create(body: CreatePaymentFormData): Promise<BackofficePaymentItem> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return parseOutput<BackofficePaymentItem>(res)
  }

  async listClients(): Promise<BackofficeClientItem[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/clients`, { cache: "no-store" })
    return parseOutput<BackofficeClientItem[]>(res)
  }
}
