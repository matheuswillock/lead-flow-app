import { describe, expect, it } from "bun:test"
import { publicFormDraftSchema } from "./validation"

const sourceId = "11111111-1111-4111-8111-111111111111"
const targetId = "22222222-2222-4222-8222-222222222222"

function draftWithRule(rule: Record<string, unknown>) {
  return {
    name: "Qualificação",
    questions: [],
    rules: [
      {
        sourceQuestionId: sourceId,
        targetQuestionId: targetId,
        operator: "equals",
        comparisonValue: "sim",
        action: "show",
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
})
