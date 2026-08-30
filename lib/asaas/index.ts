/**
 * Transporte multi-conta — E1 de [[10 — Fundações Multi-conta — Backend]] (DA2).
 *
 * Este módulo é o ponto de entrada usado por `lib/asaas.ts` (reexport fino,
 * mantido para não quebrar nenhum dos 85 call-sites existentes). Tudo aqui é
 * ligado à conta `primary` — quem precisa da conta `legacy` usa
 * `createAsaasClient("legacy")` explicitamente (opt-in, DA1).
 */

import { resolveAsaasAccount } from "./asaas-account"
import { buildAsaasEndpoints } from "./asaas-endpoints"
import { createAsaasClient } from "./asaas-client"

export { resolveAsaasAccount } from "./asaas-account"
export type { AsaasAccountId, ResolvedAsaasAccount } from "./asaas-account"
export { buildAsaasEndpoints } from "./asaas-endpoints"
export type { AsaasEndpoints } from "./asaas-endpoints"
export { createAsaasClient } from "./asaas-client"
export type { AsaasClient } from "./asaas-client"

/**
 * Base URL de checkouts hospedados Asaas (`/c/...`), respeitando o ambiente.
 * Produção → `www.asaas.com`; sandbox/local/CI → `sandbox.asaas.com`.
 * Nunca apontar para produção fora do ambiente de produção.
 */
export function getAsaasCheckoutBaseUrl(): string {
  return resolveAsaasAccount("primary").baseUrl
}

// Headers padrão para requisições ao Asaas (getter — leitura dinâmica, igual
// ao comportamento original de lib/asaas.ts; nunca lança mesmo sem API key).
export const asaasHeaders = {
  "Content-Type": "application/json",
  get access_token() {
    const { apiKey } = resolveAsaasAccount("primary")
    return `$${apiKey}` || ""
  },
}

// Endpoints da API Asaas ligados à conta primary (getters — leitura dinâmica).
export const asaasApi = {
  get customers() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).customers
  },
  get subscriptions() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).subscriptions
  },
  get payments() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).payments
  },
  /** @deprecated use `notifications` — path legado apontava para /notifications */
  get webhooks() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).webhooks
  },
  get notifications() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).notifications
  },
  customerNotifications: (customerId: string) =>
    buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).customerNotifications(customerId),
  notificationById: (notificationId: string) =>
    buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).notificationById(notificationId),
  get notificationsBatch() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).notificationsBatch
  },
  get checkouts() {
    return buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).checkouts
  },
  pixQrCode: (paymentId: string) =>
    buildAsaasEndpoints(resolveAsaasAccount("primary").baseUrl).pixQrCode(paymentId),
}

export type AsaasCustomerNotification = {
  id: string
  customer: string
  enabled: boolean
  emailEnabledForProvider?: boolean
  smsEnabledForProvider?: boolean
  emailEnabledForCustomer?: boolean
  smsEnabledForCustomer?: boolean
  phoneCallEnabledForCustomer?: boolean
  whatsappEnabledForCustomer?: boolean
  event?: string
  scheduleOffset?: number
  deleted?: boolean
}

export type AsaasCustomerNotificationUpdate = {
  id: string
  enabled?: boolean
  emailEnabledForProvider?: boolean
  smsEnabledForProvider?: boolean
  emailEnabledForCustomer?: boolean
  smsEnabledForCustomer?: boolean
  phoneCallEnabledForCustomer?: boolean
  whatsappEnabledForCustomer?: boolean
  scheduleOffset?: number
}

export function buildDisableCustomerFacingNotificationPatch(
  notification: Pick<AsaasCustomerNotification, "id">
): AsaasCustomerNotificationUpdate {
  return {
    id: notification.id,
    emailEnabledForCustomer: false,
    smsEnabledForCustomer: false,
    phoneCallEnabledForCustomer: false,
    whatsappEnabledForCustomer: false,
  }
}

// Helper para fazer requisições ao Asaas com tratamento de erros — ligado à
// conta primary. Resolve a conta a cada chamada (nunca cacheia no import),
// igual ao getter original: env pode mudar entre chamadas em teste.
export async function asaasFetch(endpoint: string, options?: RequestInit) {
  return createAsaasClient("primary").request(endpoint, options)
}

// Função legada mantida para compatibilidade (pré-E5; aposentada quando o
// helper `createAsaasCustomer` migrar para AsaasCustomerGateway).
export async function asaas(path: string, init?: RequestInit) {
  const account = resolveAsaasAccount("primary")
  if (!account.apiKey) {
    throw new Error("ASAAS_API_KEY não configurada")
  }

  const apiRoot = `${account.baseUrl}/api/v3`
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  headers.set("access_token", `$${account.apiKey}`)
  const res = await fetch(`${apiRoot}${path}`, { ...init, headers, cache: "no-store" })
  if (!res.ok) throw new Error(`Asaas ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Exemplo: criar cliente no Asaas */
export async function createAsaasCustomer(payload: {
  name: string
  email?: string
  cpfCnpj?: string
  phone?: string
}) {
  return asaas("/customers", { method: "POST", body: JSON.stringify(payload) })
}
