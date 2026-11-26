export interface BackofficeClientItem {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  asaasCustomerId: string | null
}

export interface BackofficeCardCheckout {
  /** Cartão liberado na configuração do provedor (e com chave pública disponível). */
  cardOffered: boolean
  /** Provedor que tokeniza o cartão no navegador (escolhe o campo de cartão). */
  provider: string | null
  /** Chave pública do SDK do provedor, usada só para tokenizar no navegador. */
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
  /** Só dígitos; preenchido só quando o cliente não tem telefone cadastrado. */
  phone?: string
  /** Token de uso único do cartão, gerado no navegador. */
  cardToken?: string
}

export interface IBackofficePaymentsService {
  list(clientId?: string): Promise<BackofficePaymentItem[]>
  create(data: CreatePaymentFormData): Promise<BackofficePaymentItem>
  listClients(): Promise<BackofficeClientItem[]>
  loadCardCheckout(): Promise<BackofficeCardCheckout>
}
