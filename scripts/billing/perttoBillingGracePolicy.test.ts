import { describe, expect, it } from "bun:test"
import {
  isApprovedPerttoActivationOverride,
  isExactPerttoCrmEntitlement,
  resolveApprovedPerttoExpiry,
  validatePerttoApplyState,
} from "./perttoBillingGracePolicy"

const APPROVED_OVERRIDE = {
  source: "operational_manual_access_override",
  changeType: "activate_access_pertto_only",
  before: { permanent: false, canonicalStatus: "past_due", profileStatus: "past_due" },
  after: { permanent: false, canonicalStatus: "active", profileStatus: "active" },
  metadata: {
    reason: "liberação operacional solicitada",
    teamId: "862835fd-54ad-4ebd-986a-b5392f1bb227",
    asaasMutation: false,
  },
}

describe("Pertto billing-grace policy", () => {
  it("aceita apenas o override manual registrado, sem assinatura Asaas", () => {
    expect(isApprovedPerttoActivationOverride({
      profileStatus: "active",
      canonicalStatus: "active",
      profileAsaasSubscriptionId: null,
      canonicalAsaasSubscriptionId: null,
      overrideLog: APPROVED_OVERRIDE,
    })).toBe(true)
  })

  it("recusa status ativo sem evidência compatível ou com assinatura Asaas", () => {
    expect(isApprovedPerttoActivationOverride({
      profileStatus: "active",
      canonicalStatus: "active",
      profileAsaasSubscriptionId: "asaas-subscription",
      canonicalAsaasSubscriptionId: null,
      overrideLog: APPROVED_OVERRIDE,
    })).toBe(false)
    expect(isApprovedPerttoActivationOverride({
      profileStatus: "active",
      canonicalStatus: "active",
      profileAsaasSubscriptionId: null,
      canonicalAsaasSubscriptionId: null,
      overrideLog: null,
    })).toBe(false)
    expect(isApprovedPerttoActivationOverride({
      profileStatus: "active",
      canonicalStatus: "active",
      profileAsaasSubscriptionId: null,
      canonicalAsaasSubscriptionId: null,
      overrideLog: {
        ...APPROVED_OVERRIDE,
        metadata: { ...APPROVED_OVERRIDE.metadata, teamId: "other-team" },
      },
    })).toBe(false)
  })

  it("aceita somente o entitlement CRM na concessão da Pertto", () => {
    expect(isExactPerttoCrmEntitlement(["crm"])).toBe(true)
    expect(isExactPerttoCrmEntitlement(["crm", "email"])).toBe(false)
    expect(isExactPerttoCrmEntitlement([])).toBe(false)
  })

  it("limita a concessão ao fim de 27/10 no fuso de São Paulo", () => {
    expect(resolveApprovedPerttoExpiry("2026-10-28T03:00:00.000Z", new Date("2026-10-17T00:00:00.000Z")))
      .toBe("2026-10-28T03:00:00.000Z")
    expect(() => resolveApprovedPerttoExpiry("2026-10-29T03:00:00.000Z", new Date("2026-10-17T00:00:00.000Z")))
      .toThrow("O prazo aprovado")
  })

  it("recusa concessões concorrentes ou estado que mudou após o dry-run", () => {
    expect(() => validatePerttoApplyState({
      profileStatus: "past_due",
      canonicalStatus: "past_due",
      profileAsaasSubscriptionId: null,
      canonicalAsaasSubscriptionId: null,
      overrideLog: null,
      restorePastDue: false,
      expiry: "2026-10-28T03:00:00.000Z",
      plannedGrace: null,
      activeGraces: [
        { id: "one", expiresAt: null },
        { id: "two", expiresAt: null },
      ],
    })).toThrow("múltiplas concessões")

    expect(() => validatePerttoApplyState({
      profileStatus: "active",
      canonicalStatus: "active",
      profileAsaasSubscriptionId: null,
      canonicalAsaasSubscriptionId: null,
      overrideLog: null,
      restorePastDue: true,
      expiry: "2026-10-28T03:00:00.000Z",
      plannedGrace: null,
      activeGraces: [],
    })).toThrow("estado de cobrança mudou")
  })
})
