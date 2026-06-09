import { NextRequest } from "next/server";
import { UserFunction, UserRole } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { isManagerLikeRole } from "@/lib/roles";
import { resolveTimezone } from "@/lib/dates";

export type TeamAccess = {
  supabaseId: string;
  teamId: string;
  profileId: string;
  profileEmail: string | null;
  profileName: string | null;
  isMaster: boolean;
  managerId: string;
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  userTimezone: string;
  teamMember: {
    role: UserRole;
    functions: UserFunction[];
  };
};

export type TeamAccessResult =
  | { access: TeamAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number };

export async function getTeamAccess(request: NextRequest): Promise<TeamAccessResult> {
  const supabaseId = request.headers.get("x-supabase-user-id");
  if (!supabaseId) {
    return {
      error: new Output(false, [], ["ID do usuário é obrigatório"], null),
      status: 401,
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      email: true,
      fullName: true,
      activeTeamId: true,
      isMaster: true,
      managerId: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      timezone: true,
    },
  });

  if (!profile) {
    return {
      error: new Output(false, [], ["Perfil não encontrado"], null),
      status: 404,
    };
  }

  const url = new URL(request.url);
  const teamId =
    request.headers.get("x-team-id") ||
    url.searchParams.get("teamId") ||
    profile.activeTeamId;

  if (!teamId) {
    return {
      error: new Output(false, [], ["teamId é obrigatório"], null),
      status: 400,
    };
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_profileId: {
        teamId,
        profileId: profile.id,
      },
    },
    select: {
      role: true,
      functions: true,
      team: {
        select: {
          masterId: true,
        },
      },
    },
  });

  if (!teamMember) {
    return {
      error: new Output(false, [], ["Acesso negado para este time"], null),
      status: 403,
    };
  }

  return {
    access: {
      supabaseId,
      teamId,
      profileId: profile.id,
      profileEmail: profile.email,
      profileName: profile.fullName,
      isMaster: teamMember.team.masterId === profile.id || profile.isMaster,
      managerId: profile.managerId ?? teamMember.team.masterId ?? profile.id,
      canCreateAccountUsers:
        teamMember.role === "manager" && profile.canCreateAccountUsers === true,
      canManageAccountTeams:
        teamMember.role === "manager" && profile.canManageAccountTeams === true,
      userTimezone: resolveTimezone(profile.timezone),
      teamMember,
    },
  };
}

export function isManagerOrMaster(access: TeamAccess): boolean {
  return access.isMaster || isManagerLikeRole(access.teamMember.role);
}

export function hasLeadAccess(teamMember: { role: UserRole; functions: UserFunction[] }) {
  if (isManagerLikeRole(teamMember.role)) {
    return true;
  }

  return teamMember.functions?.includes("SDR");
}

export function hasLeadActivityAccess(teamMember: { role: UserRole; functions: UserFunction[] }) {
  if (isManagerLikeRole(teamMember.role)) {
    return true;
  }

  return teamMember.functions?.includes("SDR") || teamMember.functions?.includes("CLOSER");
}

export function hasDelegatedUserCreationAccess(access: TeamAccess) {
  return access.isMaster || access.canCreateAccountUsers;
}

export function hasDelegatedTeamManagementAccess(access: TeamAccess) {
  return access.isMaster || access.canManageAccountTeams;
}
