import { createAsaasClient } from "@/lib/asaas"
import type {
  AsaasMigrationCard,
  AsaasMigrationCardholder,
  AsaasMigrationCustomer,
  AsaasLegacyPayment,
  AsaasLegacySubscription,
  AsaasMigrationPayment,
  AsaasMigrationSubscription,
  IAsaasMigrationGateway,
} from "./IAsaasMigrationGateway"

async function findByExternalReference<T>(endpoint: string, externalReference: string): Promise<T | null> {
  const client = createAsaasClient("primary")
  const query = `${endpoint}?externalReference=${encodeURIComponent(externalReference)}`
  const response = await client.request(query, { method: "GET" })
  const records = Array.isArray(response?.data) ? response.data : []
  if (records.length > 1) throw new Error(`Asaas retornou múltiplos recursos para externalReference=${externalReference}`)
  return records[0] ?? null
}

function requireId(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Asaas não retornou ${label} válido`)
  }
  return value
}

export class AsaasMigrationGateway implements IAsaasMigrationGateway {
  async findCustomerByExternalReference(externalReference: string): Promise<AsaasMigrationCustomer | null> {
    return findByExternalReference<AsaasMigrationCustomer>(createAsaasClient("primary").endpoints.customers, externalReference)
  }

  async findPaymentByExternalReference(externalReference: string): Promise<AsaasMigrationPayment | null> {
    return findByExternalReference<AsaasMigrationPayment>(createAsaasClient("primary").endpoints.payments, externalReference)
  }

  async findSubscriptionByExternalReference(externalReference: string): Promise<AsaasMigrationSubscription | null> {
    return findByExternalReference<AsaasMigrationSubscription>(createAsaasClient("primary").endpoints.subscriptions, externalReference)
  }

  async findPrimarySubscription(subscriptionId: string): Promise<AsaasMigrationSubscription | null> {
    const client = createAsaasClient("primary")
    try {
      const response = await client.request(
        `${client.endpoints.subscriptions}/${encodeURIComponent(subscriptionId)}`,
        { method: "GET" },
      )
      return {
        id: requireId(response?.id, "ID da assinatura primary"),
        customer: requireId(response?.customer, "customer da assinatura primary"),
        value: Number(response?.value),
        cycle: String(response?.cycle),
        nextDueDate: String(response?.nextDueDate),
        status: String(response?.status),
        externalReference: response?.externalReference ?? null,
      }
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null
      throw error
    }
  }

  async listPrimarySubscriptionPayments(subscriptionId: string): Promise<AsaasMigrationPayment[]> {
    const client = createAsaasClient("primary")
    const response = await client.request(
      `${client.endpoints.payments}?subscription=${encodeURIComponent(subscriptionId)}&limit=100`,
      { method: "GET" },
    )
    return Array.isArray(response?.data)
      ? response.data.map((payment: any) => ({
          id: requireId(payment?.id, "ID da cobrança primary"),
          status: String(payment?.status),
          value: Number(payment?.value),
          customer: requireId(payment?.customer, "customer da cobrança primary"),
          subscription: payment?.subscription ?? null,
          dueDate: payment?.dueDate ?? null,
          externalReference: payment?.externalReference ?? null,
        }))
      : []
  }

  async cancelPrimaryPayment(paymentId: string): Promise<boolean> {
    const client = createAsaasClient("primary")
    try {
      const response = await client.request(
        `${client.endpoints.payments}/${encodeURIComponent(paymentId)}`,
        { method: "DELETE", suppressLegacy404Alert: true },
      )
      return response?.deleted === true || response?.id === paymentId
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return true
      throw error
    }
  }

  async inactivatePrimarySubscription(subscriptionId: string): Promise<AsaasMigrationSubscription> {
    const client = createAsaasClient("primary")
    const response = await client.request(
      `${client.endpoints.subscriptions}/${encodeURIComponent(subscriptionId)}`,
      { method: "PUT", body: JSON.stringify({ status: "INACTIVE" }) },
    )
    return {
      id: requireId(response?.id, "ID da assinatura primary"),
      customer: requireId(response?.customer, "customer da assinatura primary"),
      value: Number(response?.value),
      cycle: String(response?.cycle),
      nextDueDate: String(response?.nextDueDate),
      status: String(response?.status),
      externalReference: response?.externalReference ?? null,
    }
  }

  async removeLegacySubscription(subscriptionId: string) {
    const client = createAsaasClient("legacy")
    const response = await client.request(
      `${client.endpoints.subscriptions}/${encodeURIComponent(subscriptionId)}`,
      { method: "DELETE" }
    )
    return { deleted: response?.deleted === true || response?.id === subscriptionId }
  }

  async findLegacySubscription(subscriptionId: string): Promise<AsaasLegacySubscription | null> {
    const client = createAsaasClient("legacy")
    try {
      const response = await client.request(
        `${client.endpoints.subscriptions}/${encodeURIComponent(subscriptionId)}`,
        { method: "GET", suppressLegacy404Alert: true },
      )
      return { id: requireId(response?.id, "ID da assinatura legada"), status: String(response?.status) }
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return null
      throw error
    }
  }

  async listLegacySubscriptionPayments(subscriptionId: string): Promise<AsaasLegacyPayment[]> {
    const client = createAsaasClient("legacy")
    const response = await client.request(
      `${client.endpoints.payments}?subscription=${encodeURIComponent(subscriptionId)}&limit=100`,
      { method: "GET" },
    )
    return Array.isArray(response?.data)
      ? response.data.map((payment: any) => ({
          id: requireId(payment?.id, "ID da cobrança legada"),
          status: String(payment?.status),
          subscription: payment?.subscription ?? null,
          dueDate: payment?.dueDate ?? null,
        }))
      : []
  }

  async cancelLegacyPayment(paymentId: string): Promise<boolean> {
    const client = createAsaasClient("legacy")
    try {
      const response = await client.request(
        `${client.endpoints.payments}/${encodeURIComponent(paymentId)}`,
        { method: "DELETE", suppressLegacy404Alert: true },
      )
      return response?.deleted === true || response?.id === paymentId
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) return true
      throw error
    }
  }

  async inactivateLegacySubscription(subscriptionId: string): Promise<AsaasLegacySubscription> {
    const client = createAsaasClient("legacy")
    const response = await client.request(
      `${client.endpoints.subscriptions}/${encodeURIComponent(subscriptionId)}`,
      { method: "PUT", body: JSON.stringify({ status: "INACTIVE" }) },
    )
    return {
      id: requireId(response?.id, "ID da assinatura legada"),
      status: String(response?.status),
    }
  }

  async tokenizeCard(input: {
    customerId: string
    card: AsaasMigrationCard
    cardholder: AsaasMigrationCardholder
    remoteIp: string
  }) {
    const client = createAsaasClient("primary")
    const response = await client.request(
      `${client.endpoints.payments.replace(/\/payments$/, "")}/creditCard/tokenizeCreditCard`,
      {
        method: "POST",
        body: JSON.stringify({
          customer: input.customerId,
          creditCard: input.card,
          creditCardHolderInfo: input.cardholder,
          remoteIp: input.remoteIp,
        }),
      }
    )
    return { token: requireId(response?.creditCardToken, "token do cartão") }
  }

  async createImmediatePayment(input: {
    account: "primary" | "legacy"
    customerId: string
    value: number
    externalReference: string
    creditCardToken: string
    remoteIp: string
  }) {
    const client = createAsaasClient(input.account)
    const response = await client.request(client.endpoints.payments, {
      method: "POST",
      body: JSON.stringify({
        customer: input.customerId,
        billingType: "CREDIT_CARD",
        value: input.value,
        dueDate: new Date().toISOString().slice(0, 10),
        externalReference: input.externalReference,
        creditCardToken: input.creditCardToken,
        remoteIp: input.remoteIp,
      }),
    })
    return response as AsaasMigrationPayment
  }

  async createSubscription(input: {
    account: "primary" | "legacy"
    customerId: string
    value: number
    cycle: string
    nextDueDate: string
    externalReference: string
    billingType?: string
    creditCardToken?: string
  }) {
    const client = createAsaasClient(input.account)
    const response = await client.request(client.endpoints.subscriptions, {
      method: "POST",
      body: JSON.stringify({
        customer: input.customerId,
        billingType: input.billingType ?? "CREDIT_CARD",
        value: input.value,
        cycle: input.cycle,
        nextDueDate: input.nextDueDate,
        externalReference: input.externalReference,
        ...(input.creditCardToken ? { creditCardToken: input.creditCardToken } : {}),
      }),
    })
    return {
      id: requireId(response?.id, "ID da assinatura"),
      customer: requireId(response?.customer, "customer da assinatura"),
      value: Number(response?.value),
      cycle: String(response?.cycle),
      nextDueDate: String(response?.nextDueDate),
      status: String(response?.status),
      externalReference: response?.externalReference ?? null,
    } satisfies AsaasMigrationSubscription
  }
}

export const asaasMigrationGateway = new AsaasMigrationGateway()
