import type { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import type {
  ITeamMembersRepository,
  ProfileTeamMembership,
  TeamMemberGoogleConnectionStatus,
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
        managerId: true,
      },
    });
  }

  async findTeam(teamId: string): Promise<TeamMembersTeam | null> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        masterId: true,
        name: true,
        master: { select: { sponsorMasterId: true } },
      },
    });
    if (!team) return null;
    return {
      id: team.id,
      masterId: team.masterId,
      name: team.name,
      sponsorMasterId: team.master.sponsorMasterId,
    };
  }

  async findMembership(teamId: string, profileId: string) {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: {
        id: true,
        role: true,
        canManageAccountTeams: true,
      },
    });
  }

  async canManageTeamMembers(requesterProfileId: string, teamMasterId: string): Promise<boolean> {
    if (requesterProfileId === teamMasterId) {
      return true;
    }

    const delegatedMembership = await prisma.teamMember.findFirst({
      where: {
        profileId: requesterProfileId,
        role: "manager",
        canManageAccountTeams: true,
        team: { masterId: teamMasterId },
      },
      select: { id: true },
    });

    return delegatedMembership !== null;
  }

  async findMembers(teamId: string): Promise<TeamMembersListItem[]> {
    // O boolean de conexão Google é derivado via filtro relacional em query
    // separada para não trafegar o refreshToken (segredo) na resposta.
    const [members, connectedProfiles] = await Promise.all([
      prisma.teamMember.findMany({
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
            },
          },
        },
        orderBy: { profile: { fullName: "asc" } },
      }),
      prisma.profile.findMany({
        where: {
          teamMemberships: { some: { teamId } },
          googleConnection: { is: { refreshToken: { not: null }, revokedAt: null } },
        },
        select: { id: true },
      }),
    ]);

    const connectedIds = new Set(connectedProfiles.map((p) => p.id));

    return members.map((member) => ({
      ...member,
      profile: {
        ...member.profile,
        googleCalendarConnected: connectedIds.has(member.profile.id),
      },
    }));
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

  async findInternalTransferTargetsWithSearch(sourceTeamId: string, query?: string) {
    const q = query?.trim();
    const targetTeamFilter: Prisma.TeamWhereInput | undefined = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            {
              members: {
                some: {
                  functions: { has: "CLOSER" },
                  profile: {
                    OR: [
                      { fullName: { contains: q, mode: "insensitive" } },
                      { email: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : undefined;

    const routes = await prisma.teamTransferRoute.findMany({
      where: {
        sourceTeamId,
        ...(targetTeamFilter ? { targetTeam: targetTeamFilter } : {}),
      },
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

  async hasTransferRoute(sourceTeamId: string, targetTeamId: string): Promise<boolean> {
    const route = await prisma.teamTransferRoute.findUnique({
      where: {
        sourceTeamId_targetTeamId: {
          sourceTeamId,
          targetTeamId,
        },
      },
      select: { id: true },
    });

    return route !== null;
  }

  async findExistingMember(teamId: string, profileId: string): Promise<{ id: string } | null> {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { id: true },
    });
  }

  async findMemberSnapshot(teamId: string, profileId: string) {
    return prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: {
        id: true,
        teamId: true,
        profileId: true,
        role: true,
        functions: true,
        createdAt: true,
      },
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

  async findRoleAndFunctions(teamId: string, profileId: string) {
    return await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { role: true, functions: true },
    });
  }

  /**
   * Uma unica query para TODAS as memberships do perfil — nunca uma por time.
   * O caso real que originou o escopo "member-all" tem 41 memberships.
   */
  async findMembershipsByProfile(profileId: string): Promise<ProfileTeamMembership[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { profileId, team: { deletedAt: null } },
      select: {
        teamId: true,
        role: true,
        functions: true,
        team: { select: { masterId: true } },
      },
      orderBy: { teamId: "asc" },
    });

    return memberships.map((membership) => ({
      teamId: membership.teamId,
      role: membership.role,
      functions: membership.functions,
      accountMasterId: membership.team.masterId,
    }));
  }

  async findNotificationRecipients(input: {
    teamId: string;
    roles: UserRole[];
    onlyTransferAuthorized?: boolean;
  }) {
    return await prisma.teamMember.findMany({
      where: {
        teamId: input.teamId,
        role: input.roles.length === 1 ? input.roles[0] : { in: input.roles },
        ...(input.onlyTransferAuthorized && { canTransferAccountLeads: true }),
      },
      select: {
        profileId: true,
        profile: { select: { email: true, fullName: true } },
      },
    });
  }

  async findTransferAuthorization(teamId: string, profileId: string) {
    return await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { role: true, canTransferAccountLeads: true },
    });
  }

  /**
   * SPEC 13 (Agenda na Criação de Lead), A-E3 — extraído de
   * `participantDispatch.ts`, que fazia essa mesma consulta direto com
   * `prisma.teamMember.findMany` (violação de `nonRepositoryDatabaseAccessAllowlist`,
   * DA9). O booleano derivado (`isGoogleConnectionActive`) já basta para
   * quem chama decidir o canal — o `refreshToken` cru não sai do repositório.
   */
  async findGoogleConnectionStatusByEmails(
    teamId: string,
    emails: string[]
  ): Promise<TeamMemberGoogleConnectionStatus[]> {
    if (emails.length === 0) return [];

    const teamMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        profile: {
          email: {
            in: emails,
            mode: "insensitive",
          },
        },
      },
      select: {
        profile: {
          select: {
            email: true,
            googleConnection: {
              select: {
                refreshToken: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });

    return teamMembers
      .filter((member): member is typeof member & { profile: { email: string } } =>
        Boolean(member.profile.email)
      )
      .map((member) => ({
        email: member.profile.email,
        googleCalendarConnected: isGoogleConnectionActive(member.profile.googleConnection),
      }));
  }
}

export const teamMembersRepository = new TeamMembersRepository();
