import { describe, expect, it } from "bun:test"
import {
  isPublicFormLeadResolvedMetricType,
  mapPublicFormMetricToRadarEventType,
  PUBLIC_FORM_LEAD_RESOLVED_METRIC_TYPES,
} from "@/lib/radar/map-public-form-metric-to-radar-event"

describe("map-public-form-metric-to-radar-event (D8)", () => {
  it("cobertura completa do enum PublicFormMetricType", () => {
    const all = [
      "form_viewed",
      "form_started",
      "question_viewed",
      "question_answered",
      "question_skipped",
      "form_completed",
      "lead_created",
      "lead_attached",
      "meeting_scheduled",
    ] as const

    for (const type of all) {
      expect(mapPublicFormMetricToRadarEventType(type)).toMatch(/^form\./)
    }
  })

  it("tipos lead-resolvidos incluem abertura/início (atribuição e-mail→form)", () => {
    expect([...PUBLIC_FORM_LEAD_RESOLVED_METRIC_TYPES].sort()).toEqual([
      "form_completed",
      "form_started",
      "form_viewed",
      "lead_attached",
      "lead_created",
    ])
    expect(isPublicFormLeadResolvedMetricType("form_viewed")).toBe(true)
    expect(isPublicFormLeadResolvedMetricType("form_completed")).toBe(true)
  })

  it("tipo desconhecido retorna null", () => {
    expect(mapPublicFormMetricToRadarEventType("unknown_metric")).toBeNull()
  })
})
