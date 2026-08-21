import { describe, expect, it } from "bun:test"
import {
  buildPublicFormIdentityGateIdempotencyKey,
  buildPublicFormMetricEventKey,
  buildPublicFormQuestionAnsweredEventKey,
  buildPublicFormSubmitRequestKey,
} from "@/lib/public-forms/metric-keys"

describe("public form metric keys", () => {
  it("gera requestKey estável por sessão", () => {
    expect(buildPublicFormSubmitRequestKey("session-a")).toBe("session-a:submit")
    expect(buildPublicFormSubmitRequestKey("session-a")).toBe(
      buildPublicFormSubmitRequestKey("session-a"),
    )
  })

  it("gera eventKey estável por sessão e tipo", () => {
    expect(buildPublicFormMetricEventKey("session-a", "form_completed")).toBe(
      "session-a:form_completed",
    )
    expect(buildPublicFormMetricEventKey("session-a", "lead_attached")).toBe(
      "session-a:lead_attached",
    )
    expect(buildPublicFormMetricEventKey("session-a", "form_completed")).toBe(
      buildPublicFormMetricEventKey("session-a", "form_completed"),
    )
  })

  it("gera eventKey unificado de question_answered (funil = Radar)", () => {
    expect(buildPublicFormQuestionAnsweredEventKey("session-a", "qid-1")).toBe(
      "session-a:question_answered:qid-1",
    )
  })

  it("decoupla a reavaliação A+C do eventKey estável da métrica", () => {
    const eventKey = buildPublicFormQuestionAnsweredEventKey("session-a", "qid-1")
    const first = buildPublicFormIdentityGateIdempotencyKey(eventKey, "119")
    const corrected = buildPublicFormIdentityGateIdempotencyKey(eventKey, "(11) 98888-7777")
    expect(first).toMatch(new RegExp(`^${eventKey}:rev:[a-f0-9]{16}$`))
    expect(corrected).toMatch(new RegExp(`^${eventKey}:rev:[a-f0-9]{16}$`))
    expect(first).not.toBe(corrected)
    expect(buildPublicFormIdentityGateIdempotencyKey(eventKey, "119")).toBe(first)
  })
})
