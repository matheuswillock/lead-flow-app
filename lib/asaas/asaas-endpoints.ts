/**
 * Endpoints da API Asaas — função pura (DA2). Substitui o objeto de getters
 * `asaasApi` de `lib/asaas.ts`, que lia `process.env` a cada acesso. Aqui a
 * baseUrl (host bare, sem `/api/v3`) já vem resolvida pelo chamador
 * (`resolveAsaasAccount`) — este módulo nunca toca `process.env`.
 */

export type AsaasEndpoints = {
  customers: string
  subscriptions: string
  payments: string
  /** @deprecated use `notifications` — path legado apontava para /notifications */
  webhooks: string
  notifications: string
  customerNotifications: (customerId: string) => string
  notificationById: (notificationId: string) => string
  notificationsBatch: string
  checkouts: string
  pixQrCode: (paymentId: string) => string
}

export function buildAsaasEndpoints(baseUrl: string): AsaasEndpoints {
  const root = `${baseUrl}/api/v3`

  return {
    customers: `${root}/customers`,
    subscriptions: `${root}/subscriptions`,
    payments: `${root}/payments`,
    webhooks: `${root}/notifications`,
    notifications: `${root}/notifications`,
    customerNotifications: (customerId: string) => `${root}/customers/${customerId}/notifications`,
    notificationById: (notificationId: string) => `${root}/notifications/${notificationId}`,
    notificationsBatch: `${root}/notifications/batch`,
    checkouts: `${root}/checkouts`,
    pixQrCode: (paymentId: string) => `${root}/payments/${paymentId}/pixQrCode`,
  }
}
