/**
 * Gateway de silenciamento de customer Asaas — 30-E2 (M0.3/M0.5).
 *
 * Interface + implementação (DIP, mesmo padrão de `asaasReadOnlyGateway.ts`
 * de E1). Diferente do gateway read-only, este EMITE escrita — por isso a
 * interface só expõe exatamente os três verbos que o silenciamento precisa
 * (nunca DELETE, nunca criação de customer): não é possível, por
 * construção, usar este gateway para nada além de desabilitar notificação.
 *
 * Reusa `createAsaasClient(accountId)` (nunca hardcoded para "primary" —
 * ao contrário de `AsaasCustomerService`, que é fixo em "primary" e por
 * isso não pode ser reaproveitado aqui: o silenciamento roda contra a
 * conta LEGACY) e `buildDisableCustomerFacingNotificationPatch`
 * (`@/lib/asaas`, função pura já usada por `AsaasCustomerService` e
 * `ProfileAsaasCustomerSyncUseCase`).
 */

import { createAsaasClient, type AsaasClient } from "@/lib/asaas/asaas-client"
import { resolveAsaasAccount, type AsaasAccountId } from "@/lib/asaas/asaas-account"
import {
  buildAsaasEndpoints,
  buildDisableCustomerFacingNotificationPatch,
  type AsaasCustomerNotification,
  type AsaasCustomerNotificationUpdate,
} from "@/lib/asaas"

export interface IAsaasCustomerSilencingGateway {
  readonly accountId: AsaasAccountId

  /**
   * `PUT /customers/{id}` com APENAS `notificationDisabled: true` no body
   * (T-30.6 — nunca sobrescreve `externalReference` nem dado cadastral).
   */
  disableCustomerNotifications(customerId: string): Promise<void>

  listCustomerNotificationChannels(customerId: string): Promise<AsaasCustomerNotification[]>

  disableNotificationChannelsBatch(
    customerId: string,
    notifications: AsaasCustomerNotification[]
  ): Promise<AsaasCustomerNotification[]>
}

export class AsaasCustomerSilencingGateway implements IAsaasCustomerSilencingGateway {
  readonly accountId: AsaasAccountId
  private readonly client: AsaasClient
  private readonly endpoints: ReturnType<typeof buildAsaasEndpoints>

  constructor(accountId: AsaasAccountId) {
    this.accountId = accountId
    this.client = createAsaasClient(accountId)
    this.endpoints = buildAsaasEndpoints(resolveAsaasAccount(accountId).baseUrl)
  }

  async disableCustomerNotifications(customerId: string): Promise<void> {
    // Payload mínimo e explícito — nada além de `notificationDisabled`,
    // por construção (não é um patch parcial de um objeto maior que
    // poderia carregar campos cadastrais por acidente).
    await this.client.request(`${this.endpoints.customers}/${customerId}`, {
      method: "PUT",
      body: JSON.stringify({ notificationDisabled: true }),
    })
  }

  async listCustomerNotificationChannels(customerId: string): Promise<AsaasCustomerNotification[]> {
    const result = await this.client.request(this.endpoints.customerNotifications(customerId), {
      method: "GET",
    })
    return Array.isArray(result?.data) ? (result.data as AsaasCustomerNotification[]) : []
  }

  async disableNotificationChannelsBatch(
    customerId: string,
    notifications: AsaasCustomerNotification[]
  ): Promise<AsaasCustomerNotification[]> {
    if (notifications.length === 0) return []

    const patch: AsaasCustomerNotificationUpdate[] = notifications.map((notification) =>
      buildDisableCustomerFacingNotificationPatch(notification)
    )

    const result = await this.client.request(this.endpoints.notificationsBatch, {
      method: "POST",
      body: JSON.stringify({ customer: customerId, notifications: patch }),
    })

    if (Array.isArray(result?.data)) return result.data as AsaasCustomerNotification[]
    if (Array.isArray(result)) return result as AsaasCustomerNotification[]
    return []
  }
}

export function createAsaasCustomerSilencingGateway(
  accountId: AsaasAccountId
): IAsaasCustomerSilencingGateway {
  return new AsaasCustomerSilencingGateway(accountId)
}
