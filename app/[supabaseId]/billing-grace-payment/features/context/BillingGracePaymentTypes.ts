export type BillingGracePaymentMethod = "PIX" | "CREDIT_CARD"

/**
 * Cartão pelo Abacate Pay (checkout transparente). Enquanto o backend não envia este bloco, a
 * renovação aceita só PIX; quando enviar, a tela libera o cartão sem outra mudança no front.
 */
export type BillingGraceCardCheckout = {
  publicKey: string
  /** Dados do master já cadastrados, usados na validação do cartão (o Abacate exige). */
  payer: { name: string; email: string; taxId: string; cellphone: string }
}

/** Usuário adicional da conta (operador ou manager, cobrados igual). */
export type BillingGraceBilledUser = { id: string; name: string; email: string; role: string }

/** Um prazo de renovação com o que está sendo cobrado nele (valores em reais). */
export type BillingGraceCycleQuote = {
  cycle: string
  label: string
  months: number
  periodStart: string
  periodEnd: string
  planPixTotal: number
  planCardTotal: number | null
  maxInstallments: number
  unlimitedUsers: boolean
  billedUsers: BillingGraceBilledUser[]
  /** Todos os usuários adicionais, para o master escolher quem manter. */
  accountUsers: BillingGraceBilledUser[]
  billedTeams: { name: string }[]
  extraUserPrice: number
  extraTeamPrice: number
  extraUsersTotal: number
  extraTeamsTotal: number
  pixTotal: number
  cardTotal: number | null
  /** A conta tem ilimitado hoje e perde ao renovar neste prazo. */
  losesUnlimitedUsers: boolean
}

export type BillingGracePaymentQuote = {
  cycles: BillingGraceCycleQuote[]
  currentCycle: string | null
  hasUnlimitedUsers: boolean
  expiresAt: string
  cardCheckout?: BillingGraceCardCheckout | null
}

export type BillingGracePaymentRecord = {
  id: string
  /** pending (PIX aguardando ou cartão em análise), completed ou failed. */
  status: string
  /** Prazo cobrado neste pagamento. */
  cycle?: string
  amountCents: number
  effectivePriceCents: number
  method?: BillingGracePaymentMethod
  paymentInstructions: { brCode?: string; brCodeBase64?: string; expiresAt?: string } | null
  failureReason?: string | null
}

export type BillingGraceCardInput = {
  cycle: string
  keptUserIds: string[]
  cardToken: string
  installments: number
}

export interface IBillingGracePaymentState {
  isLoading: boolean;
  error: string | null;
  quote: BillingGracePaymentQuote | null
  payment: BillingGracePaymentRecord | null
}

export interface IBillingGracePaymentActions {
  load: () => Promise<void>;
  /** Gera o PIX do prazo escolhido, cobrando só os usuários mantidos. */
  createPayment: (cycle: string, keptUserIds: string[]) => Promise<void>
  createCardPayment: (input: BillingGraceCardInput) => Promise<void>
  refreshPayment: () => Promise<void>
  /** Volta ao formulário depois de um cartão recusado. */
  resetPayment: () => void
}

export interface IBillingGracePaymentContext extends IBillingGracePaymentState, IBillingGracePaymentActions {}
