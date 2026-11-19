import { describe, expect, test } from "bun:test"
import type { AccountAccessRestrictionReason } from "@/app/api/shared/accountAccessDecision/types"
import { getAccessPausedCopy } from "./accountAccessPausedCopy"

const reasons: AccountAccessRestrictionReason[] = [
  "banned",
  "past_due",
  "suspended",
  "canceled",
  "subscription_unavailable",
]

describe("getAccessPausedCopy", () => {
  test("cada motivo tem uma descrição própria", () => {
    const descriptions = reasons.map((reason) => getAccessPausedCopy(reason, true).description)

    expect(new Set(descriptions).size).toBe(reasons.length)
  })

  test("usa a descrição genérica quando não há motivo", () => {
    expect(getAccessPausedCopy(undefined, false).description).toBe(
      "Esta conta está com o acesso pausado."
    )
  })

  test("pagamento pendente orienta o master a regularizar o pagamento", () => {
    expect(getAccessPausedCopy("past_due", true)).toEqual({
      description: "Esta conta está com um pagamento pendente.",
      guidance: "Regularize o pagamento para liberar o acesso desta conta.",
    })
  })

  test("suspenso e cancelado orientam o master a reativar a assinatura", () => {
    expect(getAccessPausedCopy("suspended", true)).toEqual({
      description: "A assinatura desta conta está suspensa.",
      guidance: "Reative a assinatura para liberar o acesso desta conta.",
    })
    expect(getAccessPausedCopy("canceled", true)).toEqual({
      description: "A assinatura desta conta foi cancelada.",
      guidance: "Reative a assinatura para voltar a usar a conta.",
    })
  })

  test("assinatura indisponível orienta recarregar antes de falar com o time", () => {
    expect(getAccessPausedCopy("subscription_unavailable", true)).toEqual({
      description: "Não conseguimos confirmar a assinatura desta conta.",
      guidance: "Recarregue a página. Se continuar assim, fale com o time de assinaturas.",
    })
  })

  test("quem não é o master é orientado a avisar o administrador, em qualquer motivo", () => {
    for (const reason of ["past_due", "suspended", "canceled"] as const) {
      expect(getAccessPausedCopy(reason, false).guidance).toBe(
        "Avise o administrador desta conta para que ele entre em contato com o time de assinaturas."
      )
    }
    expect(getAccessPausedCopy("subscription_unavailable", false).guidance).toBe(
      "Recarregue a página. Se continuar assim, avise o administrador desta conta."
    )
  })

  test("banido nunca é tratado como pendência de pagamento, nem para o master", () => {
    const copy = getAccessPausedCopy("banned", true)

    expect(copy.description).toBe("Esta conta está com o acesso pausado.")
    expect(copy.guidance).toBe("Fale com o time de assinaturas para entender como seguir.")
    expect(getAccessPausedCopy("banned", false).guidance).toBe(copy.guidance)
  })
})
