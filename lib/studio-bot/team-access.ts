import { prisma } from "@/app/api/infra/data/prisma";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { resolveTimezone } from "@/lib/dates";

export async function resolveStudioBotTeamAccess(
  profileId: string,
  teamId?: string | null
): Promise<TeamAccess | null> {
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      supabaseId: true,
      email: true,
      fullName: true,
      activeTeamId: true,
      isMaster: true,
      managerId: true,
      timezone: true,
    },
  });

  if (!profile?.supabaseId) {
    return null;
  }

  const resolvedTeamId = teamId ?? profile.activeTeamId;
  if (!resolvedTeamId) {
    return null;
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { teamId_profileId: { teamId: resolvedTeamId, profileId } },
    select: {
      role: true,
      functions: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      canTransferAccountLeads: true,
      canViewAllTeams: true,
    },
  });

  if (!teamMember && !profile.isMaster) {
    return null;
  }

  return {
    supabaseId: profile.supabaseId,
    teamId: resolvedTeamId,
    profileId: profile.id,
    profileEmail: profile.email,
    profileName: profile.fullName,
    isMaster: profile.isMaster,
    managerId: profile.managerId ?? profile.id,
    canCreateAccountUsers: teamMember?.canCreateAccountUsers ?? profile.isMaster,
    canManageAccountTeams: teamMember?.canManageAccountTeams ?? false,
    canTransferAccountLeads: teamMember?.canTransferAccountLeads ?? false,
    canViewAllTeams: teamMember?.canViewAllTeams ?? false,
    userTimezone: resolveTimezone(profile.timezone),
    teamMember: teamMember ?? { role: "manager", functions: [] },
  };
}
