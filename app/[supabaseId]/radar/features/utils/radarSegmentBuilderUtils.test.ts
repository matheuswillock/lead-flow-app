import { describe, expect, it } from "bun:test"
import {
  conditionNeedsValueInput,
  isRulesValidForSave,
  getEventTypeIcon,
  isMilestoneEventType,
  buildTabHref,
  buildProfileHref,
  eventTypePrefixToChannel,
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

  it("event: windowDays inválido (zero, negativo ou não inteiro) invalida a regra", () => {
    for (const windowDays of [0, -1, 1.5]) {
      expect(
        isRulesValidForSave(
          rulesWith([{ kind: "event", eventType: "email.opened", occurrence: "occurred", windowDays }])
        )
      ).toBe(false)
    }
    expect(
      isRulesValidForSave(
        rulesWith([{ kind: "event", eventType: "email.opened", occurrence: "occurred", windowDays: 7 }])
      )
    ).toBe(true)
  })

  it("profile_field (lastSeenAt/within_days): valor inválido (zero, negativo, não numérico) invalida a regra", () => {
    for (const value of [0, -1, "abc", true, undefined]) {
      expect(
        isRulesValidForSave(
          rulesWith([{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value }])
        )
      ).toBe(false)
    }
    expect(
      isRulesValidForSave(
        rulesWith([{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value: 7 }])
      )
    ).toBe(true)
    expect(
      isRulesValidForSave(
        rulesWith([{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value: "7" }])
      )
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

  it("marcos (D5) usam ícones distintos dos genéricos equivalentes", () => {
    expect(getEventTypeIcon("lead.milestone.new_opportunity")).not.toBe(getEventTypeIcon("lead.created"))
    expect(getEventTypeIcon("portfolio.renewed")).not.toBe(getEventTypeIcon("portfolio.created"))
    expect(getEventTypeIcon("portfolio.brokerage_transfer")).toBe(getEventTypeIcon("lead.milestone.new_opportunity"))
    expect(getEventTypeIcon("profile.first_contact")).toBeDefined()
    expect(getEventTypeIcon("profile.first_contact")).not.toBe(getEventTypeIcon("lead.milestone.new_opportunity"))
  })
})

describe("isMilestoneEventType", () => {
  it("reconhece marcos de status de lead, carteira e primeiro contato", () => {
    expect(isMilestoneEventType("lead.milestone.new_opportunity")).toBe(true)
    expect(isMilestoneEventType("lead.milestone.invoice_payment")).toBe(true)
    expect(isMilestoneEventType("lead.milestone.future_sale")).toBe(true)
    expect(isMilestoneEventType("lead.milestone.contract_finalized")).toBe(true)
    expect(isMilestoneEventType("portfolio.renewed")).toBe(true)
    expect(isMilestoneEventType("portfolio.brokerage_transfer")).toBe(true)
    expect(isMilestoneEventType("profile.first_contact")).toBe(true)
  })

  it("não marca eventos comuns como marco", () => {
    expect(isMilestoneEventType("lead.created")).toBe(false)
    expect(isMilestoneEventType("lead.status_changed")).toBe(false)
    expect(isMilestoneEventType("portfolio.created")).toBe(false)
    expect(isMilestoneEventType("portfolio.renewal_due")).toBe(false)
    expect(isMilestoneEventType("email.opened")).toBe(false)
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

describe("eventTypePrefixToChannel", () => {
  it("mapeia prefixos de e-mail para E-mail", () => {
    expect(eventTypePrefixToChannel("email.opened")).toBe("E-mail")
    expect(eventTypePrefixToChannel("email.clicked")).toBe("E-mail")
    expect(eventTypePrefixToChannel("email.bounced")).toBe("E-mail")
  })

  it("mapeia prefixos de whatsapp para WhatsApp", () => {
    expect(eventTypePrefixToChannel("whatsapp.message_received")).toBe("WhatsApp")
    expect(eventTypePrefixToChannel("whatsapp.message_sent")).toBe("WhatsApp")
  })

  it("mapeia prefixos de formulário para Formulário", () => {
    expect(eventTypePrefixToChannel("form.viewed")).toBe("Formulário")
    expect(eventTypePrefixToChannel("form.started")).toBe("Formulário")
    expect(eventTypePrefixToChannel("form.completed")).toBe("Formulário")
  })

  it("mapeia prefixos de pixel para Pixel", () => {
    expect(eventTypePrefixToChannel("pixel.pageview")).toBe("Pixel")
    expect(eventTypePrefixToChannel("pixel.click")).toBe("Pixel")
  })

  it("mapeia prefixos de lead para CRM", () => {
    expect(eventTypePrefixToChannel("lead.status_changed")).toBe("CRM")
    expect(eventTypePrefixToChannel("lead.milestone.contract_finalized")).toBe("CRM")
  })

  it("mapeia prefixos de portfolio para CRM", () => {
    expect(eventTypePrefixToChannel("portfolio.renewed")).toBe("CRM")
    expect(eventTypePrefixToChannel("portfolio.brokerage_transfer")).toBe("CRM")
  })

  it("mapeia prefixos de profile para CRM", () => {
    expect(eventTypePrefixToChannel("profile.first_contact")).toBe("CRM")
  })

  it("mapeia prefixos desconhecidos para Outros", () => {
    expect(eventTypePrefixToChannel("custom.event")).toBe("Outros")
    expect(eventTypePrefixToChannel("unknown")).toBe("Outros")
  })
})
