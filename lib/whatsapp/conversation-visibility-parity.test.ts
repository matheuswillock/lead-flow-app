import { describe, expect, it } from "bun:test"
import {
  buildOperatorConversationVisibilityWhere,
  operatorCanViewConversation,
} from "./conversation-access"

const PROFILE_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_ID = "22222222-2222-4222-8222-222222222222"

describe("paridade TS×RLS (operator visibility)", () => {
  const scenarios = [
    {
      name: "conversa atribuída ao operator",
      input: {
        profileId: PROFILE_ID,
        assignedProfileId: PROFILE_ID,
        leadId: null,
        normalizedPhone: "5511999999999",
        leadAssignedTo: null,
        leadCloserId: null,
        operatorLeadPhones: [] as string[],
      },
      expected: true,
    },
    {
      name: "conversa sem responsável",
      input: {
        profileId: PROFILE_ID,
        assignedProfileId: null,
        leadId: null,
        normalizedPhone: "5511999999999",
        leadAssignedTo: null,
        leadCloserId: null,
        operatorLeadPhones: [],
      },
      expected: true,
    },
    {
      name: "conversa atribuída a outro operator sem lead",
      input: {
        profileId: PROFILE_ID,
        assignedProfileId: OTHER_ID,
        leadId: null,
        normalizedPhone: "5511888888888",
        leadAssignedTo: null,
        leadCloserId: null,
        operatorLeadPhones: [],
      },
      expected: false,
    },
    {
      name: "lead do operator por telefone sem leadId na conversa",
      input: {
        profileId: PROFILE_ID,
        assignedProfileId: OTHER_ID,
        leadId: null,
        normalizedPhone: "5511777777777",
        leadAssignedTo: null,
        leadCloserId: null,
        operatorLeadPhones: ["5511777777777"],
      },
      expected: true,
    },
    {
      name: "lead vinculado com assignedTo do operator",
      input: {
        profileId: PROFILE_ID,
        assignedProfileId: OTHER_ID,
        leadId: "lead-1",
        normalizedPhone: "5511666666666",
        leadAssignedTo: PROFILE_ID,
        leadCloserId: null,
        operatorLeadPhones: [],
      },
      expected: true,
    },
  ] as const

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      expect(operatorCanViewConversation(scenario.input)).toBe(scenario.expected)
    })
  }

  it("buildOperatorConversationVisibilityWhere cobre os mesmos casos positivos", () => {
    const where = buildOperatorConversationVisibilityWhere(PROFILE_ID, ["5511777777777"])
    expect(where.OR).toHaveLength(4)
  })
})
