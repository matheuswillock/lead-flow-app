import type {
  SelfCheckoutOptionsDTO,
  SelfCheckoutRequest,
  SelfCheckoutResponse,
} from "@/lib/self-checkout/contracts"

export interface ISelfCheckoutService {
  /** Planos e preços vigentes; o preço nunca é guardado no navegador. */
  getOptions(): Promise<SelfCheckoutOptionsDTO>
  /** Cria a adesão e devolve o token da página de pagamento. */
  create(request: SelfCheckoutRequest): Promise<SelfCheckoutResponse>
}
