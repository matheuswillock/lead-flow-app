export interface BackofficeClientItem {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  asaasCustomerId: string | null
}

export interface BackofficeCardCheckout {
  /** Cartão liberado na configuração do provider (e com chave pública disponível). */
  cardOffered: boolean
  /** Chave pública do abacatepay.js, usada só para tokenizar no navegador. */
  publicKey: string | null
}

export interface BackofficePaymentItem {
  id: string
  clientId: string
  billingType: string
  status: string
  amount: string | number
  dueDate: string | null
  description: string | null
  invoiceUrl: string | null
  pixQrCode: string | null
  pixPayload: string | null
  asaasPaymentId: string | null
  createdAt: string
}

export interface CreatePaymentFormData {
  clientId: string
  billingType?: string
  amount: number
  dueDate?: string
  description?: string
  /** Preenchido só quando o cliente não tem CPF ou CNPJ cadastrado. */
  cpfCnpj?: string
  /** Token de uso único do cartão, gerado no navegador. */
  cardToken?: string
}

export interface IBackofficePaymentsService {
  list(clientId?: string): Promise<BackofficePaymentItem[]>
  create(data: CreatePaymentFormData): Promise<BackofficePaymentItem>
  listClients(): Promise<BackofficeClientItem[]>
  loadCardCheckout(): Promise<BackofficeCardCheckout>
}
