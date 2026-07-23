import { describe, expect, it } from "bun:test"
import {
  conditionNeedsValueInput,
  isRulesValidForSave,
  getEventTypeIcon,
  buildTabHref,
  buildProfileHref,
} from "./radarSegmentBuilderUtils"
import type { RadarSegmentCondition, RadarSegmentRules } from "../context/RadarTypes"

describe("conditionNeedsValueInput", () => {
  it("profile_field: is_empty/not_empty não exigem value; eq/neq/contains exigem", () => {
    expect(
      conditionNeedsValueInput({ kind: "profile_field", field: "primaryEmail", operator: "is_empty" })
    ).toBe(false)
    expect(
      conditionNeedsValueInput({ kind: "profile_field", field: "primaryEmail", operator: "not_empty" })
    ).toBe(false)
    expect(
      conditionNeedsValueInput({ kind: "profile_field", field: "primaryEmail", operator: "eq", value: "a" })
    ).toBe(true)
  })

  it("profile_field (lastSeenAt): before/after/within_days sempre exigem value", () => {
    for (const operator of ["before", "after", "within_days"] as const) {
      expect(
        conditionNeedsValueInput({ kind: "profile_field", field: "lastSeenAt", operator, value: 1 })
      ).toBe(true)
    }
  })

  it("lead_custom_field: mesma regra de is_empty/not_empty", () => {
    expect(
      conditionNeedsValueInput({
        kind: "lead_custom_field",
        definitionId: "d1",
        operator: "not_empty",
      })
    ).toBe(false)
    expect(
      conditionNeedsValueInput({ kind: "lead_custom_field", definitionId: "d1", operator: "eq", value: "x" })
    ).toBe(true)
  })

  it("consent/event/lead_status nunca exigem value input (não têm campo value livre)", () => {
    expect(conditionNeedsValueInput({ kind: "consent", channel: "email", status: "allowed" })).toBe(false)
    expect(
      conditionNeedsValueInput({ kind: "event", eventType: "email.opened", occurrence: "occurred" })
    ).toBe(false)
    expect(conditionNeedsValueInput({ kind: "lead_status", statuses: ["scheduled"] })).toBe(false)
  })
})

function rulesWith(conditions: RadarSegmentCondition[]): RadarSegmentRules {
  return { match: "all", conditions }
}

describe("isRulesValidForSave", () => {
  it("rejeita 0 condições", () => {
    expect(isRulesValidForSave(rulesWith([]))).toBe(false)
  })

  it("rejeita mais de 10 condições", () => {
    const conditions = Array.from({ length: 11 }, () => ({
      kind: "lead_status" as const,
      statuses: ["scheduled"],
    }))
    expect(isRulesValidForSave(rulesWith(conditions))).toBe(false)
  })

  it("aceita exatamente 10 condições completas", () => {
    const conditions = Array.from({ length: 10 }, () => ({
      kind: "lead_status" as const,
      statuses: ["scheduled"],
    }))
    expect(isRulesValidForSave(rulesWith(conditions))).toBe(true)
  })

  it("profile_field: incompleta sem value quando operador exige", () => {
    expect(
      isRulesValidForSave(rulesWith([{ kind: "profile_field", field: "primaryEmail", operator: "eq" }]))
    ).toBe(false)
    expect(
      isRulesValidForSave(
        rulesWith([{ kind: "profile_field", field: "primaryEmail", operator: "is_empty" }])
      )
    ).toBe(true)
  })

  it("event: incompleto com eventType vazio", () => {
    expect(
      isRulesValidForSave(rulesWith([{ kind: "event", eventType: "  ", occurrence: "occurred" }]))
    ).toBe(false)
    expect(
      isRulesValidForSave(rulesWith([{ kind: "event", eventType: "email.opened", occurrence: "occurred" }]))
    ).toBe(true)
  })

  it("lead_custom_field: incompleto sem definitionId ou sem value quando exigido", () => {
    expect(
      isRulesValidForSave(rulesWith([{ kind: "lead_custom_field", definitionId: "", operator: "eq", value: "x" }]))
    ).toBe(false)
    expect(
      isRulesValidForSave(
        rulesWith([{ kind: "lead_custom_field", definitionId: "d1", operator: "not_empty" }])
      )
    ).toBe(true)
  })

  it("lead_status: incompleto com statuses vazio", () => {
    expect(isRulesValidForSave(rulesWith([{ kind: "lead_status", statuses: [] }]))).toBe(false)
  })
})

describe("getEventTypeIcon", () => {
  it("resolve por prefixo conhecido", () => {
    expect(getEventTypeIcon("email.opened")).toBeDefined()
    expect(getEventTypeIcon("whatsapp.message_received")).toBeDefined()
    expect(getEventTypeIcon("portfolio.renewal_due")).toBeDefined()
    expect(getEventTypeIcon("lead.created")).toBeDefined()
    expect(getEventTypeIcon("crm_lead_created")).toBeDefined()
  })

  it("diferencia ícones entre prefixos distintos", () => {
    expect(getEventTypeIcon("email.opened")).not.toBe(getEventTypeIcon("whatsapp.message_received"))
  })

  it("cai no fallback para prefixo desconhecido", () => {
    expect(getEventTypeIcon("unknown.thing")).toBeDefined()
  })
})

describe("buildTabHref", () => {
  it("omite o param tab quando o valor é o default (perfis)", () => {
    expect(buildTabHref("/radar", new URLSearchParams(), "perfis")).toBe("/radar")
  })

  it("inclui ?tab=segmentos quando não-default", () => {
    expect(buildTabHref("/radar", new URLSearchParams(), "segmentos")).toBe("/radar?tab=segmentos")
  })

  it("preserva outros params existentes", () => {
    expect(buildTabHref("/radar", new URLSearchParams("perfil=abc"), "segmentos")).toBe(
      "/radar?perfil=abc&tab=segmentos"
    )
  })

  it("remove tab ao voltar para perfis, preservando outros params", () => {
    expect(buildTabHref("/radar", new URLSearchParams("tab=segmentos&perfil=abc"), "perfis")).toBe(
      "/radar?perfil=abc"
    )
  })
})

describe("buildProfileHref", () => {
  it("inclui ?perfil=<id> ao abrir", () => {
    expect(buildProfileHref("/radar", new URLSearchParams(), "abc")).toBe("/radar?perfil=abc")
  })

  it("remove o param ao fechar (profileId null)", () => {
    expect(buildProfileHref("/radar", new URLSearchParams("perfil=abc"), null)).toBe("/radar")
  })

  it("preserva o tab ativo ao abrir/fechar o perfil", () => {
    expect(buildProfileHref("/radar", new URLSearchParams("tab=segmentos"), "abc")).toBe(
      "/radar?tab=segmentos&perfil=abc"
    )
    expect(buildProfileHref("/radar", new URLSearchParams("tab=segmentos&perfil=abc"), null)).toBe(
      "/radar?tab=segmentos"
    )
  })
})
