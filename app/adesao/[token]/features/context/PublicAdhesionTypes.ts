export type PublicAdhesionStatusKey =
  | "pending"
  | "paid"
  | "overdue"
  | "expired"
  | "canceled"

export type PublicAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual"
export type PublicAdhesionBillingType = "PIX" | "CREDIT_CARD"

export interface PublicAdhesionDetails {
  id: string
  fullName: string
  phone: string
  cpfCnpj: string | null
  email: string | null
  billingType: PublicAdhesionBillingType | null
  status: PublicAdhesionStatusKey
  cycle: PublicAdhesionBillingCycleKey
  cycleLabel: string
  cycleMonths: number
  modules: string[]
  extraTeams: number
  extraUsers: number
  monthlyBaseAmount: number
  monthlyExtraTeamsAmount: number
  monthlyExtraUsersAmount: number
  monthlyTotalAmount: number
  totalAmount: number
  maxInstallments: number
  pixMonthlyTotalAmount: number
  pixTotalAmount: number
  creditCardMonthlyTotalAmount: number
  creditCardTotalAmount: number
  maxCardInstallments: number
  createdAt: string
  paidAt: string | null
  expiresAt: string
}

export interface PublicAdhesionCheckoutInput {
  fullName: string
  email: string
  phone: string
  cpfCnpj: string
  postalCode: string
  address: string
  addressNumber: string
  neighborhood: string
  complement: string | null
  city: string
  state: string
  billingType: PublicAdhesionBillingType
  installments?: number
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
}

export interface PublicAdhesionPayment {
  adhesionId: string
  paymentId: string | null
  status: PublicAdhesionStatusKey
  billingType: string | null
  amount: number
  invoiceUrl: string | null
  bankSlipUrl: string | null
  pix?: {
    encodedImage: string
    payload: string
    expirationDate: string | null
  }
  boleto?: {
    bankSlipUrl: string | null
    identificationField: string
    barCode: string
    dueDate: string | null
  }
}
