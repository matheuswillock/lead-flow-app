import { describe, expect, it } from "bun:test"
import {
  buildPublicFormMetricEventKey,
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
})
