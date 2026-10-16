import { describe, expect, it } from "bun:test"
import { AccountAccessDecisionService } from "./AccountAccessDecisionService"
import type { AccountAccessRecord } from "@/app/api/shared/accountAccessDecision/types"

/**
 * Cenário representativo do bug reportado:
 * - profile fixture, master do time ativo
 * - billingOwner resolvido = ele mesmo (master do time ativo)
 * - relation corretor_studio_profile_subscriptions: status past_due,
 *   nextDue 2026-03-13, hasPermanentSubscription true, cycle MONTHLY
 * - userType member_pro vigente (2026-10-15 → 2027-01-23)
 * - sem grace para o time, isBanned false
 *
 * Esperado (usuário comum): acesso liberado — permanente e member_pro
 * vigente estão acima de status past_due / due date vencida.
 */
function brunoOwnAccount(): AccountAccessRecord {
  return {
    billingOwnerId: "profile-own-account",
    subscriptionStatus: "past_due",
    subscriptionNextDueDate: new Date("2026-03-13T00:00:00.000Z"),
    hasPermanentSubscription: true,
    annualSubscriptionActive: false,
    memberProActive: true,
    memberProBlocked: false,
    temporaryAccessGranted: false,
    temporaryAccessUntil: null,
    isBanned: false,
  }
}

/**
 * Contraponto observado na investigação: Bruno é membro de ~20 times e
 * vários têm master de terceiros com assinatura restrita (ex.: past_due
 * sem permanente/grace). Para esses times a decisão é restricted — o gate
 * preserva a escolha explícita (resolveActiveTeamId) e exibe a pausa com
 * o switcher como recuperação.
 */
function restrictedThirdPartyTeam(): AccountAccessRecord {
  return {
    billingOwnerId: "profile-third-party-master",
    subscriptionStatus: "suspended",
    subscriptionNextDueDate: new Date("2026-11-05T00:00:00.000Z"),
    hasPermanentSubscription: false,
    annualSubscriptionActive: false,
    memberProActive: false,
    memberProBlocked: false,
    temporaryAccessGranted: false,
    temporaryAccessUntil: null,
    isBanned: false,
  }
}

describe("AccountAccessDecisionService - regressão de acesso por conta", () => {
  it("libera a conta própria: permanente + member_pro vigente vencem past_due", () => {
    const decision = new AccountAccessDecisionService().decide(brunoOwnAccount())

    expect(decision).toEqual({ state: "allowed" })
  })

  it("restringe time de terceiro com master suspenso (gate exibe pausa + switcher)", () => {
    const decision = new AccountAccessDecisionService().decide(restrictedThirdPartyTeam())

    expect(decision).toEqual({ state: "restricted", reason: "suspended" })
  })
})
