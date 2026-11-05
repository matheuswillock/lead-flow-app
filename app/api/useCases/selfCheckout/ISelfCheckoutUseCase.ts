import type { Output } from "@/lib/output"
import type { SelfCheckoutRequest } from "@/lib/self-checkout/contracts"

/** Garante que o provider de PIX pode receber uma cobrança nova antes de qualquer escrita. */
export interface ISelfCheckoutProviderGate {
  /** Lança `SelfCheckoutError("PROVIDER_UNAVAILABLE")` quando o provider não está apto. */
  assertAvailable(): Promise<void>
}

export interface ISelfCheckoutUseCase {
  getOptions(): Promise<Output>
  create(input: SelfCheckoutRequest): Promise<Output>
}
