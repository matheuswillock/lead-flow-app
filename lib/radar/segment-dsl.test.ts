import { describe, expect, it } from "bun:test"
import { parseRadarSegmentRules, RADAR_SEGMENT_MAX_CONDITIONS } from "@/lib/radar/segment-dsl"

describe("segment-dsl", () => {
  it("aceita profile_field (texto) válido", () => {
    const rules = parseRadarSegmentRules({
      match: "all",
      conditions: [{ kind: "profile_field", field: "primaryEmail", operator: "contains", value: "@gmail.com" }],
    })
    expect(rules.conditions).toHaveLength(1)
  })

  it("aceita profile_field (data) válido e rejeita operador de texto em lastSeenAt", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value: 30 }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "contains", value: "x" }],
      })
    ).toThrow()
  })

  it("within_days exige um número de dias positivo", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value: "30" }],
      })
    ).not.toThrow()

    for (const value of ["abc", 0, -5, true, [30]]) {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "within_days", value }],
        })
      ).toThrow()
    }
  })

  it("before/after exigem uma data ISO válida com calendário correto", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "before", value: "2026-01-01T00:00:00.000Z" }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "before", value: "2026-01-01" }],
      })
    ).not.toThrow()

    for (const value of ["invalid-date", "1", "2026-02-30", "2026-13-01"]) {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "profile_field", field: "lastSeenAt", operator: "after", value }],
        })
      ).toThrow()
    }
  })

  it("profile_field exige value quando operador precisa de valor", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "primaryEmail", operator: "eq" }],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "profile_field", field: "primaryEmail", operator: "is_empty" }],
      })
    ).not.toThrow()
  })

  it("aceita consent válido e rejeita channel/status fora do catálogo", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "consent", channel: "email", status: "blocked" }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "consent", channel: "sms", status: "blocked" }],
      })
    ).toThrow()
  })

  it("aceita event válido (com e sem windowDays) e rejeita eventType vazio", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "event", eventType: "email.opened", occurrence: "occurred", windowDays: 30 }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "event", eventType: "email.opened", occurrence: "not_occurred" }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "event", eventType: "", occurrence: "occurred" }],
      })
    ).toThrow()
  })

  it("aceita lead_custom_field válido e exige value para eq/neq/contains", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [
          { kind: "lead_custom_field", definitionId: "11111111-1111-4111-8111-111111111111", operator: "not_empty" },
        ],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [
          { kind: "lead_custom_field", definitionId: "11111111-1111-4111-8111-111111111111", operator: "eq" },
        ],
      })
    ).toThrow()
  })

  it("aceita lead_status válido e rejeita status fora do enum ou lista vazia", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "lead_status", statuses: ["contract_finalized", "disqualified"] }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "lead_status", statuses: [] }],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "lead_status", statuses: ["not_a_status"] }],
      })
    ).toThrow()
  })

  it("round-trip all/any com múltiplas condições mistas", () => {
    const rules = parseRadarSegmentRules({
      match: "any",
      conditions: [
        { kind: "consent", channel: "whatsapp", status: "allowed" },
        { kind: "event", eventType: "portfolio.renewal_due", occurrence: "occurred" },
        { kind: "lead_status", statuses: ["scheduled"] },
      ],
    })
    expect(rules.match).toBe("any")
    expect(rules.conditions).toHaveLength(3)
  })

  it("rejeita mais de RADAR_SEGMENT_MAX_CONDITIONS condições", () => {
    const conditions = Array.from({ length: RADAR_SEGMENT_MAX_CONDITIONS + 1 }, () => ({
      kind: "lead_status" as const,
      statuses: ["scheduled" as const],
    }))
    expect(() => parseRadarSegmentRules({ match: "all", conditions })).toThrow()
  })

  it("rejeita conditions vazio e kind desconhecido", () => {
    expect(() => parseRadarSegmentRules({ match: "all", conditions: [] })).toThrow()
    expect(() =>
      parseRadarSegmentRules({ match: "all", conditions: [{ kind: "unknown_kind" }] })
    ).toThrow()
  })
})
