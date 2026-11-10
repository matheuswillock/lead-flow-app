"use client"

import { useCallback, useRef, useState } from "react"

import type { AbacateCardFieldHandle } from "../components/AbacateCardField"
import { describeAbacateError } from "@/lib/payment-provider/abacate-js"

type Payer = { fullName: string; email: string; cnpj: string; phone: string }

/**
 * Estado do cartão do Abacate Pay no pagamento: parcelas, token gerado no envio e erro de
 * validação. O token vale 60 segundos e uma única cobrança, então é gerado só ao pagar.
 */
export function useAbacateCard() {
  const cardFieldRef = useRef<AbacateCardFieldHandle>(null)
  const [installmentsChoice, setInstallmentsChoice] = useState(1)
  const [card, setCard] = useState<{ token: string; lastFour: string } | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [isTokenizing, setIsTokenizing] = useState(false)

  /** Valida o cartão (com 3DS quando o banco pedir) e devolve o token; `null` se não deu. */
  const tokenizeCard = useCallback(async (payer: Payer): Promise<string | null> => {
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
      setCard({ token: result.token, lastFour: result.lastFour })
      return result.token
    } catch (error) {
      setCardError(describeAbacateError(error))
      return null
    } finally {
      setIsTokenizing(false)
    }
  }, [])

  return {
    cardFieldRef,
    installmentsChoice,
    setInstallmentsChoice,
    cardToken: card?.token ?? null,
    cardLastFour: card?.lastFour ?? null,
    cardError,
    isTokenizing,
    tokenizeCard,
  }
}
