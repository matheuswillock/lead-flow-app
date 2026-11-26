"use client"

import { forwardRef } from "react"

import type { CardTokenizerHandle } from "@/lib/payment-provider/card-tokenization"
import { getCardProviderClient, type CardFieldProps } from "./cardProviders"

type Props = CardFieldProps & {
  /** Provedor que tokeniza, vindo da configuração; define qual campo de cartão renderizar. */
  provider: string | null
}

/**
 * Campo de cartão neutro: escolhe a implementação pelo registro de provedores. As telas só
 * conhecem o contrato `CardTokenizerHandle`.
 */
export const CardTokenizationField = forwardRef<CardTokenizerHandle, Props>(function CardTokenizationField(
  { provider, publicKey, amountInCents },
  ref,
) {
  const client = getCardProviderClient(provider)
  if (!client) {
    return (
      <p role="alert" className="text-xs text-destructive">
        O provedor de pagamento configurado não tem formulário de cartão disponível.
      </p>
    )
  }
  return <client.Field ref={ref} publicKey={publicKey} amountInCents={amountInCents} />
})
