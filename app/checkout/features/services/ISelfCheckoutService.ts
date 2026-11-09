import type { CompanyLookup } from "@/lib/services/CnpjService"
import type {
  SelfCheckoutCouponQuote,
  SelfCheckoutCouponQuoteRequest,
  SelfCheckoutOptionsDTO,
  SelfCheckoutRequest,
  SelfCheckoutResponse,
} from "@/lib/self-checkout/contracts"

export interface ISelfCheckoutService {
  /** Planos e preços vigentes; o preço nunca é guardado no navegador. */
  getOptions(): Promise<SelfCheckoutOptionsDTO>
  /** Valida o cupom no servidor e devolve o desconto para o plano e a forma de pagamento. */
  quoteCoupon(request: SelfCheckoutCouponQuoteRequest): Promise<SelfCheckoutCouponQuote>
  /** Cria a adesão e devolve o token da página de pagamento. */
  create(request: SelfCheckoutRequest): Promise<SelfCheckoutResponse>
  /** Razão social e nome fantasia pelo CNPJ (consulta pública); `null` quando não encontra. */
  lookupCompany(cnpj: string): Promise<CompanyLookup | null>
}
