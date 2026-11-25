import type { ForwardRefExoticComponent, RefAttributes } from "react"

import type { CardTokenizerHandle } from "@/lib/payment-provider/card-tokenization"
import { abacateCardClient } from "./providers/abacateCardClient"

export type CardFieldProps = {
  publicKey: string
  amountInCents: number
}

/** Tudo que a tela precisa de um provedor de cartão no navegador. */
export type CardProviderClient = {
  Field: ForwardRefExoticComponent<CardFieldProps & RefAttributes<CardTokenizerHandle>>
  /** Mensagem para o operador a partir do erro do SDK do provedor. */
  describeError(error: unknown): string
}

/**
 * Registro de clientes de cartão por chave de provedor. Somar ou trocar um provedor é registrar o
 * adaptador dele aqui; telas e hooks só leem este registro.
 */
const CARD_PROVIDER_CLIENTS: Record<string, CardProviderClient> = {
  ABACATE_PAY: abacateCardClient,
}

export const GENERIC_CARD_ERROR = "Não foi possível validar o cartão. Confira os dados ou use outro cartão."

export function getCardProviderClient(provider: string | null): CardProviderClient | undefined {
  return provider ? CARD_PROVIDER_CLIENTS[provider] : undefined
}
