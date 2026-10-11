import type { AsaasAccountId } from "@/lib/asaas"

export type AsaasMigrationCard = {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export type AsaasMigrationCardholder = {
  name: string
  email: string
  cpfCnpj: string
  postalCode: string
  addressNumber: string
  addressComplement?: string | null
  phone?: string | null
  mobilePhone?: string | null
}

export type AsaasMigrationSubscription = {
  id: string
  customer: string
  value: number
  cycle: string
  nextDueDate: string
  status: string
}

export type AsaasMigrationPayment = {
  id: string
  status: string
  value: number
  customer: string
  creditCardToken?: string
}

export type AsaasMigrationCustomer = {
  id: string
  externalReference?: string | null
}

export type AsaasLegacySubscription = {
  id: string
  status: string
}

export type AsaasLegacyPayment = {
  id: string
  status: string
  subscription?: string | null
  dueDate?: string | null
}

export interface IAsaasMigrationGateway {
  findCustomerByExternalReference?(externalReference: string): Promise<AsaasMigrationCustomer | null>
  findPaymentByExternalReference?(externalReference: string): Promise<AsaasMigrationPayment | null>
  findSubscriptionByExternalReference?(externalReference: string): Promise<AsaasMigrationSubscription | null>
  removeLegacySubscription(subscriptionId: string): Promise<{ deleted: boolean }>
  findLegacySubscription?(subscriptionId: string): Promise<AsaasLegacySubscription | null>
  listLegacySubscriptionPayments?(subscriptionId: string): Promise<AsaasLegacyPayment[]>
  cancelLegacyPayment?(paymentId: string): Promise<boolean>
  inactivateLegacySubscription?(subscriptionId: string): Promise<AsaasLegacySubscription>
  tokenizeCard(input: {
    customerId: string
    card: AsaasMigrationCard
    cardholder: AsaasMigrationCardholder
    remoteIp: string
  }): Promise<{ token: string }>
  createImmediatePayment(input: {
    account: AsaasAccountId
    customerId: string
    value: number
    externalReference: string
    creditCardToken: string
    remoteIp: string
  }): Promise<AsaasMigrationPayment>
  createSubscription(input: {
    account: AsaasAccountId
    customerId: string
    value: number
    cycle: string
    nextDueDate: string
    externalReference: string
    creditCardToken: string
  }): Promise<AsaasMigrationSubscription>
}
