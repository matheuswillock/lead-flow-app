import prisma from "@/app/api/infra/data/prisma"
import type { Prisma } from "@prisma/client"
import type {
  CreateTeamWithMemberInput,
  ITeamCheckoutRepository,
  TeamCheckoutMasterProfile,
  TeamCheckoutRequesterProfile,
} from "./ITeamCheckoutRepository"

export class TeamCheckoutRepository implements ITeamCheckoutRepository {
  async findRequesterProfile(profileId: string): Promise<TeamCheckoutRequesterProfile | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        fullName: true,
        email: true,
        functions: true,
      },
    })
  }

  async findMasterProfile(masterId: string): Promise<TeamCheckoutMasterProfile | null> {
    return prisma.profile.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        fullName: true,
        email: true,
        hasPermanentSubscription: true,
        cpfCnpj: true,
        phone: true,
        postalCode: true,
        address: true,
        addressNumber: true,
        neighborhood: true,
        complement: true,
        asaasCustomerId: true,
        asaasSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionNextDueDate: true,
        subscriptionEndDate: true,
        subscriptionCycle: true,
        timezone: true,
      },
    })
  }

  async createTeamWithMember(input: CreateTeamWithMemberInput): Promise<{ teamId: string }> {
    return prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          masterId: input.masterId,
          name: input.teamName,
        },
      })

      await tx.teamMember.create({
        data: {
          profileId: input.memberProfileId,
          teamId: team.id,
          role: input.memberRole,
          functions: input.memberFunctions,
        },
      })

      return { teamId: team.id }
    })
  }

  async createPendingAction(
    masterId: string,
    payload: Prisma.InputJsonObject
  ): Promise<{ id: string }> {
    return prisma.pendingAction.create({
      data: {
        masterId,
        actionType: "create_team",
        status: "pending",
        payload,
      },
      select: { id: true },
    })
  }
}

export const teamCheckoutRepository = new TeamCheckoutRepository()
