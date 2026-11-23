"use client"

import { useCallback, useRef, useState } from "react"

import {
  describeCardTokenizationError,
  type CardTokenizerHandle,
} from "@/lib/payment-provider/card-tokenization"

type Payer = { fullName: string; email: string; cnpj: string; phone: string }

/**
 * Estado da tokenização do cartão, igual para qualquer provedor: o token vale uma cobrança, então é
 * gerado só ao pagar. A mensagem de erro vem do provedor que tokenizou.
 */
export function useCardTokenization(provider: string | null) {
  const cardFieldRef = useRef<CardTokenizerHandle>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [isTokenizing, setIsTokenizing] = useState(false)

  /** Valida o cartão (com 3DS quando o banco pedir) e devolve o token; `null` se não deu. */
  const tokenizeCard = useCallback(
    async (payer: Payer): Promise<string | null> => {
      setCardError(null)
      const field = cardFieldRef.current
      if (!field) {
        setCardError("O formulário do cartão ainda está carregando. Tente de novo em instantes.")
        return null
      }
      setIsTokenizing(true)
      try {
        const result = await field.tokenize({
          name: payer.fullName.trim(),
          email: payer.email.trim(),
          taxId: payer.cnpj,
          cellphone: payer.phone.replace(/\D/g, ""),
        })
        return result.token
      } catch (error) {
        setCardError(describeCardTokenizationError(provider, error))
        return null
      } finally {
        setIsTokenizing(false)
      }
    },
    [provider],
  )

  return { cardFieldRef, cardError, isTokenizing, tokenizeCard }
}
