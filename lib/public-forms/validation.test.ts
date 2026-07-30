import { describe, expect, it } from "bun:test"
import { createDefaultThankYouPage } from "./thank-you-pages"
import { PUBLIC_FORM_THANK_YOU_TARGET } from "./types"
import { publicFormDraftSchema } from "./validation"

const sourceId = "11111111-1111-4111-8111-111111111111"
const targetId = "22222222-2222-4222-8222-222222222222"
const middleId = "33333333-3333-4333-8333-333333333333"
const defaultThanks = createDefaultThankYouPage({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })

function draftWithRule(rule: Record<string, unknown>) {
  return {
    name: "Qualificação",
    thankYouPages: [defaultThanks],
    defaultThankYouPageId: defaultThanks.id,
    questions: [
      {
        id: sourceId,
        type: "boolean",
        title: "Pergunta 1",
        required: true,
        scoreWeight: 50,
        options: [],
      },
      {
        id: middleId,
        type: "text",
        title: "Pergunta 2",
        required: true,
        scoreWeight: 50,
        options: [],
      },
      {
        id: targetId,
        type: "text",
        title: "Pergunta 3",
        required: true,
        scoreWeight: 0,
        options: [],
      },
    ],
    rules: [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: targetId,
        operator: "equals",
        comparisonValue: "nao",
        action: "jump_to",
        ...rule,
      },
    ],
  }
}

describe("publicFormDraftSchema", () => {
  it("mantém elseAction indefinido quando omitido, sem forçar 'show'", () => {
    const parsed = publicFormDraftSchema.parse(draftWithRule({}))
    expect(parsed.rules[0]?.elseAction).toBeUndefined()
  })

  it("preserva elseAction explícito", () => {
    const parsed = publicFormDraftSchema.parse(draftWithRule({ elseAction: "skip" }))
    expect(parsed.rules[0]?.elseAction).toBe("skip")
  })

  it("rejeita jump_to com destino na página de agradecimentos", () => {
    const result = publicFormDraftSchema.safeParse(
      draftWithRule({
        targetQuestionId: PUBLIC_FORM_THANK_YOU_TARGET,
      }),
    )
    expect(result.success).toBe(false)
  })

  it("rejeita jump_to com destino anterior ou igual à origem", () => {
    const result = publicFormDraftSchema.safeParse(
      draftWithRule({
        targetQuestionId: sourceId,
      }),
    )
    expect(result.success).toBe(false)
  })

  it("aceita jump_to com destino posterior à origem", () => {
    const parsed = publicFormDraftSchema.parse(draftWithRule({}))
    expect(parsed.rules[0]?.action).toBe("jump_to")
    expect(parsed.rules[0]?.targetQuestionId).toBe(targetId)
  })
})
