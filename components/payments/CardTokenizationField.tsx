"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"

import {
  AbacateCardField,
  type AbacateCardFieldHandle,
} from "@/app/adesao/[token]/features/components/AbacateCardField"
import type { CardTokenizerHandle } from "@/lib/payment-provider/card-tokenization"

type Props = {
  /** Provedor que tokeniza, vindo da configuração; define qual campo de cartão renderizar. */
  provider: string | null
  publicKey: string
  amountInCents: number
}

/**
 * Campo de cartão neutro: escolhe a implementação pelo provedor configurado. Trocar de provedor é
 * registrar o campo dele aqui; as telas só conhecem o contrato `CardTokenizerHandle`.
 */
export const CardTokenizationField = forwardRef<CardTokenizerHandle, Props>(function CardTokenizationField(
  { provider, publicKey, amountInCents },
  ref,
) {
  const abacateRef = useRef<AbacateCardFieldHandle>(null)

  // O handle neutro repassa para o campo do provedor ativo, sem expor o tipo dele às telas.
  useImperativeHandle(
    ref,
    () => ({
      async tokenize(payer) {
        const field = abacateRef.current
        if (!field) throw new Error("Formulário do cartão indisponível")
        const { token, lastFour } = await field.tokenize(payer)
        return { token, lastFour }
      },
      get canTokenize() {
        return abacateRef.current?.canTokenize ?? false
      },
    }),
    [],
  )

  if (provider === "ABACATE_PAY") {
    return <AbacateCardField ref={abacateRef} publicKey={publicKey} amountInCents={amountInCents} />
  }
  return (
    <p role="alert" className="text-xs text-destructive">
      O provedor de pagamento configurado não tem formulário de cartão disponível.
    </p>
  )
})
