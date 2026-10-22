import { API_CLIENT_BASE } from "@/lib/route-map"
import type { IBackofficePaymentProvidersService } from "./IBackofficePaymentProvidersService"
import {
  PaymentProvidersApiError,
  type CreateProviderInstanceInput,
  type PaymentProviderEnvironment,
  type ProviderAdapterView,
  type ProviderHistoryItem,
  type ProviderInstanceView,
  type UpdateProviderInstanceInput,
} from "../context/BackofficePaymentProvidersTypes"

const BASE = `${API_CLIENT_BASE}/backoffice/payment-providers/config`
const JSON_HEADERS = { "Content-Type": "application/json" }

interface Envelope<T> {
  isValid: boolean
  errorMessages?: string[]
  result: T
}

async function readEnvelope<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !data?.isValid) {
    throw new PaymentProvidersApiError(data?.errorMessages?.[0] ?? fallbackMessage, res.status)
  }
  return data.result
}

export class BackofficePaymentProvidersService implements IBackofficePaymentProvidersService {
  async listInstances(environment: PaymentProviderEnvironment): Promise<ProviderInstanceView[]> {
    const res = await fetch(`${BASE}?environment=${environment}`, { cache: "no-store" })
    return (await readEnvelope<ProviderInstanceView[]>(res, "Erro ao listar providers")) ?? []
  }

  async listAdapters(): Promise<ProviderAdapterView[]> {
    const res = await fetch(`${BASE}/adapters`, { cache: "no-store" })
    const result = await readEnvelope<{ adapters: ProviderAdapterView[] }>(res, "Erro ao listar adapters")
    return result?.adapters ?? []
  }

  async createInstance(input: CreateProviderInstanceInput): Promise<ProviderInstanceView> {
    const res = await fetch(BASE, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) })
    return readEnvelope(res, "Erro ao criar instância")
  }

  async updateInstance(input: UpdateProviderInstanceInput): Promise<ProviderInstanceView> {
    const res = await fetch(BASE, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(input) })
    return readEnvelope(res, "Erro ao atualizar instância")
  }

  async setCredential(configId: string, key: string, value: string): Promise<ProviderInstanceView> {
    const res = await fetch(`${BASE}/credentials`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ configId, key, value }),
    })
    return readEnvelope(res, "Erro ao salvar credencial")
  }

  async removeCredential(configId: string, key: string): Promise<ProviderInstanceView> {
    const query = new URLSearchParams({ configId, key })
    const res = await fetch(`${BASE}/credentials?${query.toString()}`, { method: "DELETE" })
    return readEnvelope(res, "Erro ao remover credencial")
  }

  async runHealthCheck(id: string): Promise<ProviderInstanceView> {
    const res = await fetch(`${BASE}/health-check`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ id }),
    })
    return readEnvelope(res, "Erro ao verificar saúde")
  }

  async listHistory(configId: string): Promise<ProviderHistoryItem[]> {
    const query = new URLSearchParams({ configId })
    const res = await fetch(`${BASE}/history?${query.toString()}`, { cache: "no-store" })
    const result = await readEnvelope<{ items: ProviderHistoryItem[] }>(res, "Erro ao carregar histórico")
    return result?.items ?? []
  }
}
