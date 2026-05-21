import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeMemberRepository,
  MemberForDeletionRecord,
  MemberForUpdateRecord,
  MemberTeamMembershipRecord,
} from "./IBackofficeMemberRepository"

export class BackofficeMemberRepository implements IBackofficeMemberRepository {
  async findAdminEmailByProfileId(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { email: true },
    })
    return profile?.email ?? null
  }

  async findMemberForUpdate(memberId: string): Promise<MemberForUpdateRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        isMaster: true,
      },
    })

    return profile
  }

  async updateMemberProfile(
    memberId: string,
    data: { fullName?: string; phone?: string | null; email?: string }
  ): Promise<{ id: string } | null> {
    const payload: {
      fullName?: string
      phone?: string | null
      email?: string
    } = {}

    if (data.fullName !== undefined) payload.fullName = data.fullName
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.email !== undefined) payload.email = data.email

    if (Object.keys(payload).length === 0) {
      const existing = await prisma.profile.findUnique({
        where: { id: memberId },
        select: { id: true },
      })
      return existing
    }

    try {
      const updated = await prisma.profile.update({
        where: { id: memberId },
        data: payload,
        select: { id: true },
      })
      return updated
    } catch (error) {
      console.error("[BackofficeMemberRepository][updateMemberProfile]", error)
      return null
    }
  }

  async findMemberForDeletion(memberId: string): Promise<MemberForDeletionRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        fullName: true,
        isMaster: true,
        managerId: true,
        subscription: { select: { asaasSubscriptionId: true } },
      },
    })

    if (!profile) return null

    return {
      id: profile.id,
      supabaseId: profile.supabaseId,
      email: profile.email,
      fullName: profile.fullName,
      isMaster: profile.isMaster,
      managerId: profile.managerId,
      subscriptionAsaasId: profile.subscription?.asaasSubscriptionId ?? null,
    }
  }

  async deleteMemberCascade(memberId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.lead.deleteMany({ where: { assignedTo: memberId } })
      await tx.profile.delete({ where: { id: memberId } })
    })
  }

  async findTeamMembership(
    teamId: string,
    profileId: string
  ): Promise<MemberTeamMembershipRecord | null> {
    const membership = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { teamId: true, profileId: true },
    })
    return membership
  }

  async deleteTeamMembership(teamId: string, profileId: string): Promise<void> {
    await prisma.teamMember.delete({
      where: { teamId_profileId: { teamId, profileId } },
    })
  }
}
