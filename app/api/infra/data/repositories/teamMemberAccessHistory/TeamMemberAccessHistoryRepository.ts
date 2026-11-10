import { prisma } from "@/app/api/infra/data/prisma"
import type {
  AccessEmailDispatchStatus,
  AccessHistoryCategory,
  AccessHistoryEmail,
} from "@/lib/team-member-access/access-history"
import type {
  ITeamMemberAccessHistoryRepository,
  RecordAccessEmailInput,
  TeamMemberIdentity,
} from "./ITeamMemberAccessHistoryRepository"

const toIso = (date: Date | null) => (date ? date.toISOString() : null)

function toIdentityRole(role: string): TeamMemberIdentity["role"] {
  const normalized = role.toLowerCase()
  return normalized === "manager" || normalized === "backoffice" ? normalized : "operator"
}

export class TeamMemberAccessHistoryRepository implements ITeamMemberAccessHistoryRepository {
  async listTeamMemberIdentities(input: { teamId: string; accountId: string }): Promise<TeamMemberIdentity[]> {
    const members = await prisma.teamMember.findMany({
      where: { teamId: input.teamId, profileId: { not: input.accountId }, team: { masterId: input.accountId } },
      select: { role: true, profile: { select: { id: true, supabaseId: true, email: true, fullName: true } } },
    })
    return members.map((member) => ({
      profileId: member.profile.id,
      supabaseId: member.profile.supabaseId,
      email: member.profile.email,
      fullName: member.profile.fullName,
      role: toIdentityRole(String(member.role)),
    }))
  }

  async listLatestAccessEmails(input: {
    accountId: string
    profileIds: string[]
  }): Promise<Map<string, { status: AccessEmailDispatchStatus; createdAt: string }>> {
    const latest = new Map<string, { status: AccessEmailDispatchStatus; createdAt: string }>()
    if (input.profileIds.length === 0) return latest
    const links = await prisma.teamMemberAccessEmail.findMany({
      where: { accountId: input.accountId, profileId: { in: input.profileIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["profileId"],
      select: { profileId: true, dispatchId: true },
    })
    if (links.length === 0) return latest
    const dispatches = await prisma.backofficeEmailDispatch.findMany({
      where: { id: { in: links.map((link) => link.dispatchId) } },
      select: { id: true, status: true, createdAt: true },
    })
    const byId = new Map(dispatches.map((dispatch) => [dispatch.id, dispatch]))
    for (const link of links) {
      const dispatch = byId.get(link.dispatchId)
      if (dispatch) {
        latest.set(link.profileId, {
          status: dispatch.status as AccessEmailDispatchStatus,
          createdAt: dispatch.createdAt.toISOString(),
        })
      }
    }
    return latest
  }

  async recordAccessEmail(input: RecordAccessEmailInput): Promise<void> {
    await prisma.teamMemberAccessEmail.upsert({
      where: { dispatchId: input.dispatchId },
      create: input,
      update: {},
    })
  }

  async listAccessEmails(input: { accountId: string; profileId: string; limit: number }): Promise<AccessHistoryEmail[]> {
    // Só envios ligados a esta conta: outra corretora que tenha a mesma pessoa não aparece aqui.
    const links = await prisma.teamMemberAccessEmail.findMany({
      where: { accountId: input.accountId, profileId: input.profileId },
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: { dispatchId: true },
    })
    if (links.length === 0) return []

    const dispatches = await prisma.backofficeEmailDispatch.findMany({
      where: { id: { in: links.map((link) => link.dispatchId) }, profileId: input.profileId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        recipientEmail: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        openedAt: true,
        bouncedAt: true,
      },
    })
    return dispatches.map((dispatch) => ({
      id: dispatch.id,
      category: dispatch.category as AccessHistoryCategory,
      recipientEmail: dispatch.recipientEmail,
      status: dispatch.status as AccessEmailDispatchStatus,
      createdAt: dispatch.createdAt.toISOString(),
      deliveredAt: toIso(dispatch.deliveredAt),
      openedAt: toIso(dispatch.openedAt),
      bouncedAt: toIso(dispatch.bouncedAt),
    }))
  }
}

export const teamMemberAccessHistoryRepository = new TeamMemberAccessHistoryRepository()
