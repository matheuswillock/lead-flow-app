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

  it("aceita event com campaignId UUID e rejeita campaignId inválido", () => {
    const campaignId = "11111111-1111-4111-8111-111111111111"
    const rules = parseRadarSegmentRules({
      match: "all",
      conditions: [
        {
          kind: "event",
          eventType: "email.opened",
          occurrence: "occurred",
          campaignId,
          windowDays: 30,
        },
      ],
    })
    const condition = rules.conditions[0]
    expect(condition.kind).toBe("event")
    if (condition.kind === "event") {
      expect(condition.campaignId).toBe(campaignId)
    }

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [
          {
            kind: "event",
            eventType: "email.opened",
            occurrence: "occurred",
            campaignId: "not-a-uuid",
          },
        ],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [
          {
            kind: "event",
            eventType: "email.clicked",
            occurrence: "occurred",
          },
        ],
      })
    ).not.toThrow()
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

  it("aceita engagement_band válido e rejeita banda inválida ou lista vazia", () => {
    const rules = parseRadarSegmentRules({
      match: "any",
      conditions: [{ kind: "engagement_band", bands: ["hot", "warm"] }],
    })
    const condition = rules.conditions[0]
    expect(condition.kind).toBe("engagement_band")
    if (condition.kind === "engagement_band") {
      expect(condition.bands).toEqual(["hot", "warm"])
    }

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "engagement_band", bands: [] }],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "engagement_band", bands: ["boiling"] }],
      })
    ).toThrow()
  })

  it("aceita email_contact_list válido e rejeita listIds vazio ou não-UUID (D6)", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "email_contact_list", listIds: ["11111111-1111-4111-8111-111111111111"] }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "email_contact_list", listIds: [] }],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "any",
        conditions: [{ kind: "email_contact_list", listIds: ["not-a-uuid"] }],
      })
    ).toThrow()
  })

  it("aceita email_contact_field válido e exige value para eq/neq/contains (D6)", () => {
    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "email_contact_field", fieldKey: "cargo", operator: "not_empty" }],
      })
    ).not.toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "email_contact_field", fieldKey: "cargo", operator: "eq" }],
      })
    ).toThrow()

    expect(() =>
      parseRadarSegmentRules({
        match: "all",
        conditions: [{ kind: "email_contact_field", fieldKey: "", operator: "not_empty" }],
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

  describe("lead_field", () => {
    it("aceita status com eq e array de statuses", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "status", operator: "eq", value: ["scheduled", "no_show"] }],
        })
      ).not.toThrow()
    })

    it("rejeita status com eq e array vazio", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "status", operator: "eq", value: [] }],
        })
      ).toThrow()
    })

    it("aceita campo numérico com operador gt e number", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "currentValue", operator: "gt", value: 5000 }],
        })
      ).not.toThrow()
    })

    it("rejeita operador inválido para o campo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "currentValue", operator: "contains", value: "x" }],
        })
      ).toThrow()
    })

    it("aceita campo de data com within_days e número positivo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "meetingDate", operator: "within_days", value: 30 }],
        })
      ).not.toThrow()
    })

    it("rejeita campo de data com within_days e valor inválido", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "followUpAt", operator: "within_days", value: -1 }],
        })
      ).toThrow()
    })

    it("aceita campo de data com before e ISO date válido", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "contractDueDate", operator: "before", value: "2026-12-31" }],
        })
      ).not.toThrow()
    })

    it("rejeita campo de data com after e data inválida", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "meetingDate", operator: "after", value: "invalid" }],
        })
      ).toThrow()
    })

    it("aceita campo booleano com true/false", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "isReferral", operator: "eq", value: true }],
        })
      ).not.toThrow()

      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "isReferral", operator: "eq", value: false }],
        })
      ).not.toThrow()
    })

    it("rejeita campo booleano com value não booleano", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "isReferral", operator: "eq", value: "yes" }],
        })
      ).toThrow()
    })

    it("aceita campo texto com contains e string", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "currentHealthPlan", operator: "contains", value: "Sul" }],
        })
      ).not.toThrow()
    })

    it("aceita is_empty e not_empty sem value em qualquer campo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "any",
          conditions: [
            { kind: "lead_field", fieldKey: "soldPlan", operator: "is_empty" },
            { kind: "lead_field", fieldKey: "followUpAt", operator: "not_empty" },
          ],
        })
      ).not.toThrow()
    })

    it("rejeita fieldKey fora do catálogo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "inexistente", operator: "eq", value: "x" }],
        })
      ).toThrow()
    })

    it("rejeita status inválido no array de lead_status_multi", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "status", operator: "eq", value: ["scheduled", "not_a_status"] }],
        })
      ).toThrow()
    })

    it("rejeita número inválido (null, boolean, array vazio) para campo numérico", () => {
      for (const value of [null, false, [], ""]) {
        expect(() =>
          parseRadarSegmentRules({
            match: "all",
            conditions: [{ kind: "lead_field", fieldKey: "currentValue", operator: "eq", value }],
          })
        ).toThrow()
      }
    })

    it("aceita assignedTo e closerId com UUID válido e rejeita texto livre", () => {
      const uuid = "11111111-1111-4111-8111-111111111111"
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "assignedTo", operator: "eq", value: uuid }],
        })
      ).not.toThrow()

      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "lead_field", fieldKey: "closerId", operator: "eq", value: "João Silva" }],
        })
      ).toThrow()
    })
  })

  describe("portfolio_field", () => {
    it("aceita renewalStatus eq com enum válido", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "renewalStatus", operator: "eq", value: "to_renew" }],
        })
      ).not.toThrow()
    })

    it("rejeita renewalStatus com valor fora do enum", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "renewalStatus", operator: "eq", value: "expired" }],
        })
      ).toThrow()
    })

    it("aceita renewalAmount gt com número", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "renewalAmount", operator: "gt", value: 1000 }],
        })
      ).not.toThrow()
    })

    it("rejeita operador inválido para renewalAmount", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "renewalAmount", operator: "contains", value: "x" }],
        })
      ).toThrow()
    })

    it("aceita lastContactAt within_days positivo e rejeita negativo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "lastContactAt", operator: "within_days", value: 30 }],
        })
      ).not.toThrow()

      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "lastContactAt", operator: "within_days", value: -1 }],
        })
      ).toThrow()
    })

    it("aceita source e portfolioStatus como enum", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "any",
          conditions: [
            { kind: "portfolio_field", fieldKey: "source", operator: "eq", value: "brokerage_transfer" },
            { kind: "portfolio_field", fieldKey: "portfolioStatus", operator: "neq", value: "canceled" },
          ],
        })
      ).not.toThrow()
    })

    it("aceita amount e finalizedDateAt do histórico", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [
            { kind: "portfolio_field", fieldKey: "amount", operator: "gte", value: 500 },
            { kind: "portfolio_field", fieldKey: "finalizedDateAt", operator: "before", value: "2026-12-31" },
          ],
        })
      ).not.toThrow()
    })

    it("aceita contractType enum e rejeita inválido", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "contractType", operator: "eq", value: "individual" }],
        })
      ).not.toThrow()

      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "contractType", operator: "eq", value: "group" }],
        })
      ).toThrow()
    })

    it("aceita operadora/productName texto e is_empty", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "any",
          conditions: [
            { kind: "portfolio_field", fieldKey: "operadora", operator: "contains", value: "Unimed" },
            { kind: "portfolio_field", fieldKey: "productName", operator: "is_empty" },
            { kind: "portfolio_field", fieldKey: "renewalAmount", operator: "not_empty" },
          ],
        })
      ).not.toThrow()
    })

    it("rejeita fieldKey fora do catálogo", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [{ kind: "portfolio_field", fieldKey: "ticket", operator: "eq", value: 1 }],
        })
      ).toThrow()
    })

    it("aceita combinação carteira com renovação e valor (aceitação D13)", () => {
      expect(() =>
        parseRadarSegmentRules({
          match: "all",
          conditions: [
            { kind: "portfolio_field", fieldKey: "renewalStatus", operator: "eq", value: "to_renew" },
            { kind: "portfolio_field", fieldKey: "renewalAmount", operator: "gt", value: 1000 },
          ],
        })
      ).not.toThrow()
    })
  })
})
