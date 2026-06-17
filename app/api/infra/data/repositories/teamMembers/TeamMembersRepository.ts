import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ITeamMembersRepository,
  TeamMembersEligibleProfile,
  TeamMembersListItem,
  TeamMembersProfileOption,
  TeamMembersRequesterProfile,
  TeamMembersTeam,
} from "./ITeamMembersRepository";

export class TeamMembersRepository implements ITeamMembersRepository {
  async findRequesterProfile(supabaseId: string): Promise<TeamMembersRequesterProfile | null> {
    return prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isMaster: true,
        role: true,
        canManageAccountTeams: true,
        canTransferAccountLeads: true,
      },
    });
  }

  async findTeam(teamId: string): Promise<TeamMembersTeam | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });
  }

  async findMembership(teamId: string, profileId: string): Promise<{ id: string } | null> {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { id: true },
    });
  }

  async findMembers(teamId: string): Promise<TeamMembersListItem[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      select: {
        id: true,
        profileId: true,
        role: true,
        functions: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
            supabaseId: true,
            googleConnection: {
              select: {
                refreshToken: true,
                revokedAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMasterAccountTeamMembers(
    masterId: string
  ): Promise<Array<{ profileId: string; profile: TeamMembersProfileOption }>> {
    return prisma.teamMember.findMany({
      where: {
        team: { masterId },
      },
      distinct: ["profileId"],
      select: {
        profileId: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            supabaseId: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findMasterAccountProfiles(masterId: string): Promise<TeamMembersProfileOption[]> {
    return prisma.profile.findMany({
      where: {
        OR: [{ id: masterId }, { managerId: masterId }],
        supabaseId: { not: null },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        supabaseId: true,
      },
    });
  }

  async findTransferTargets(teamId: string) {
    const routes = await prisma.teamTransferRoute.findMany({
      where: { sourceTeamId: teamId },
      select: {
        targetTeamId: true,
        targetTeam: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { targetTeam: { name: "asc" } },
    });

    return routes.map((item) => ({
      teamId: item.targetTeamId,
      teamName: item.targetTeam.name,
    }));
  }

  async findExistingMember(teamId: string, profileId: string): Promise<{ id: string } | null> {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { id: true },
    });
  }

  async findEligibleProfile(
    profileId: string,
    masterId: string
  ): Promise<TeamMembersEligibleProfile | null> {
    return prisma.profile.findFirst({
      where: {
        id: profileId,
        OR: [{ id: masterId }, { managerId: masterId }],
      },
      select: {
        id: true,
        role: true,
        functions: true,
        supabaseId: true,
        fullName: true,
        email: true,
      },
    });
  }

  async createMember(input: Parameters<ITeamMembersRepository["createMember"]>[0]) {
    return prisma.teamMember.create({
      data: {
        teamId: input.teamId,
        profileId: input.profileId,
        role: input.role,
        functions: input.functions,
      },
    });
  }

  async deleteMember(teamId: string, profileId: string): Promise<void> {
    await prisma.teamMember.delete({
      where: { teamId_profileId: { teamId, profileId } },
    });
  }
}
