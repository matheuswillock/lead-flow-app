import { describe, expect, it } from "bun:test"
import {
  buildRadarProfileFormItems,
  RADAR_PROFILE_FORM_COMPLETION,
  resolveRadarProfileFormCompletion,
} from "./profile-forms"

describe("resolveRadarProfileFormCompletion", () => {
  it("marca completo quando houve form.completed", () => {
    expect(
      resolveRadarProfileFormCompletion(["form.started", "form.question_answered", "form.completed"]),
    ).toBe(RADAR_PROFILE_FORM_COMPLETION.complete)
  })

  it("marca incompleto quando houve resposta sem envio", () => {
    expect(resolveRadarProfileFormCompletion(["form.started", "form.question_answered"])).toBe(
      RADAR_PROFILE_FORM_COMPLETION.incomplete,
    )
  })

  it("marca iniciou sem resposta quando só há started/viewed", () => {
    expect(resolveRadarProfileFormCompletion(["form.viewed", "form.started"])).toBe(
      RADAR_PROFILE_FORM_COMPLETION.startedWithoutAnswers,
    )
  })
})

describe("buildRadarProfileFormItems", () => {
  it("agrupa eventos por formId e usa o catálogo do time", () => {
    const items = buildRadarProfileFormItems({
      events: [
        {
          eventType: "form.started",
          occurredAt: new Date("2026-08-20T12:00:00.000Z"),
          metadata: { formId: "form-1" },
        },
        {
          eventType: "form.question_answered",
          occurredAt: new Date("2026-08-20T12:01:00.000Z"),
          metadata: { formId: "form-1", questionId: "q-name" },
        },
      ],
      forms: [{ id: "form-1", name: "Qualificação PME", publicId: "pub-1" }],
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      formId: "form-1",
      publicId: "pub-1",
      name: "Qualificação PME",
      completionStatus: RADAR_PROFILE_FORM_COMPLETION.incomplete,
      answeredQuestionCount: 1,
    })
  })
})
