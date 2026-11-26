"use client"

import { forwardRef, useImperativeHandle, useRef } from "react"

import {
  AbacateCardField,
  type AbacateCardFieldHandle,
} from "@/app/adesao/[token]/features/components/AbacateCardField"
import { describeAbacateError } from "@/lib/payment-provider/abacate-js"
import type { CardTokenizerHandle } from "@/lib/payment-provider/card-tokenization"
import type { CardFieldProps, CardProviderClient } from "../cardProviders"

/** Adaptador do cartão do Abacate Pay: expõe o contrato neutro sem vazar o tipo do SDK às telas. */
const AbacateNeutralCardField = forwardRef<CardTokenizerHandle, CardFieldProps>(function AbacateNeutralCardField(
  { publicKey, amountInCents },
  ref,
) {
  const abacateRef = useRef<AbacateCardFieldHandle>(null)

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

  return <AbacateCardField ref={abacateRef} publicKey={publicKey} amountInCents={amountInCents} />
})

export const abacateCardClient: CardProviderClient = {
  Field: AbacateNeutralCardField,
  describeError: describeAbacateError,
}
