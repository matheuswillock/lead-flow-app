"use client"

import { useEffect, useState } from "react"

import type { AvailableBillingTypes } from "./availability"
import { loadAvailableBillingTypes } from "./availability-client"

/**
 * Disponibilidade de métodos para diálogos que não têm GET de detalhe próprio.
 * Começa em PIX (falha fechada): o cartão nunca pisca na tela antes da resposta.
 */
export function useAvailableBillingTypes(enabled: boolean = true): {
  availableMethods: AvailableBillingTypes
  cardOffered: boolean
} {
  const [availableMethods, setAvailableMethods] = useState<AvailableBillingTypes>(["PIX"])

  useEffect(() => {
    if (!enabled) return
    let active = true
    void loadAvailableBillingTypes().then((types) => {
      if (active) setAvailableMethods(types)
    })
    return () => {
      active = false
    }
  }, [enabled])

  return { availableMethods, cardOffered: availableMethods.includes("CREDIT_CARD") }
}
