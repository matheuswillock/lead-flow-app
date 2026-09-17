/**
 * Tipos do domínio Asaas usados pelo inventário 30-E1. Somente os campos
 * consumidos pelo script — não é o shape completo da API.
 */

export type AsaasCustomer = {
  id: string
  name: string
  email: string
  cpfCnpj?: string
  externalReference?: string
  notificationDisabled: boolean
  deleted?: boolean
}

export type AsaasSubscription = {
  id: string
  customer: string
  billingType: string
  status: string
  value: number
  nextDueDate: string
  endDate?: string
  cycle: string
  externalReference?: string
  deleted?: boolean
}

export type AsaasPayment = {
  id: string
  customer: string
  subscription?: string
  /** id do grupo de parcelamento — presente só em cobranças parceladas */
  installment?: string
  installmentNumber?: number
  billingType: string
  status: string
  value: number
  dueDate: string
  externalReference?: string
}

export type AsaasWebhookConfig = {
  id: string
  url: string
  email?: string
  enabled: boolean
  interrupted?: boolean
  events: string[]
  authToken?: string
}
