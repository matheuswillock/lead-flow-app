import { describe, expect, it, mock } from "bun:test"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { UserRole } from "@prisma/client"
import {
  buildOperatorConversationVisibilityWhere,
  resolveVisibilityScope,
} from "./conversation-access"
import { buildConversationVisibilityWhere } from "@/app/api/services/whatsapp/WhatsAppConversationAccessService"

const OPERATOR_PROFILE_ID = "11111111-1111-4111-8111-111111111111"
const OTHER_PROFILE_ID = "22222222-2222-4222-8222-222222222222"
const TEAM_ID = "33333333-3333-4333-8333-333333333333"

function makeAccess(overrides: Partial<TeamAccess> & Pick<TeamAccess, "isMaster" | "teamMember">): TeamAccess {
  return {
    supabaseId: "supabase-1",
    teamId: TEAM_ID,
    profileId: OPERATOR_PROFILE_ID,
    profileEmail: "op@test.com",
    profileName: "Operator",
    managerId: "manager-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    ...overrides,
  }
}

mock.module("@/app/api/infra/data/repositories/whatsapp/WhatsAppRepository", () => ({
  whatsAppRepository: {
    getOperatorLeadPhones: mock(async (_teamId: string, _profileId: string) => ["5511999999999"]),
  },
}))

describe("resolveVisibilityScope", () => {
  it("classifica master, manager e operator", () => {
    expect(
      resolveVisibilityScope(makeAccess({ isMaster: true, teamMember: { role: UserRole.manager, functions: [] } }))
    ).toBe("master")
    expect(
      resolveVisibilityScope(makeAccess({ isMaster: false, teamMember: { role: UserRole.manager, functions: [] } }))
    ).toBe("manager")
    expect(
      resolveVisibilityScope(makeAccess({ isMaster: false, teamMember: { role: UserRole.operator, functions: [] } }))
    ).toBe("operator")
  })
})

describe("buildOperatorConversationVisibilityWhere", () => {
  it("inclui assignedProfileId, null e cláusulas de lead", () => {
    const where = buildOperatorConversationVisibilityWhere(OPERATOR_PROFILE_ID, ["5511888888888"])
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { assignedProfileId: OPERATOR_PROFILE_ID },
        { assignedProfileId: null },
        {
          lead: {
            OR: [{ assignedTo: OPERATOR_PROFILE_ID }, { closerId: OPERATOR_PROFILE_ID }],
          },
        },
        {
          leadId: null,
          normalizedPhone: { in: ["5511888888888"] },
        },
      ])
    )
  })

  it("omite filtro de telefone quando não há leads do operator", () => {
    const where = buildOperatorConversationVisibilityWhere(OPERATOR_PROFILE_ID, [])
    expect(where.OR).toHaveLength(3)
    expect(where.OR).not.toEqual(expect.arrayContaining([expect.objectContaining({ normalizedPhone: expect.anything() })]))
  })
})

describe("buildConversationVisibilityWhere", () => {
  it("master e manager retornam undefined (vêem todo o time)", async () => {
    const master = makeAccess({ isMaster: true, teamMember: { role: UserRole.manager, functions: [] } })
    const manager = makeAccess({ isMaster: false, teamMember: { role: UserRole.manager, functions: [] } })

    await expect(buildConversationVisibilityWhere(master)).resolves.toBeUndefined()
    await expect(buildConversationVisibilityWhere(manager)).resolves.toBeUndefined()
  })

  it("operator monta OR com null, profileId e telefones de lead", async () => {
    const operator = makeAccess({ isMaster: false, teamMember: { role: UserRole.operator, functions: [] } })
    const where = await buildConversationVisibilityWhere(operator)

    expect(where?.OR).toEqual(
      expect.arrayContaining([
        { assignedProfileId: OPERATOR_PROFILE_ID },
        { assignedProfileId: null },
      ])
    )
  })

  it("operator não inclui assignedProfileId de outro usuário diretamente", async () => {
    const operator = makeAccess({ isMaster: false, teamMember: { role: UserRole.operator, functions: [] } })
    const where = await buildConversationVisibilityWhere(operator)

    expect(where?.OR).not.toEqual(
      expect.arrayContaining([{ assignedProfileId: OTHER_PROFILE_ID }])
    )
  })
})
