import type { NextRequest } from "next/server";
import { cache } from "react";
import { UserFunction, UserRole } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { isManagerLikeRole } from "@/lib/roles";
import { resolveTimezone } from "@/lib/dates";
import { ACCOUNT_MASTER_BANNED_MESSAGE } from "@/lib/account/isAccountMasterBanned";
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types";

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
  canTransferAccountLeads: boolean;
  canViewAllTeams: boolean;
  userTimezone: string;
  teamMember: {
    role: UserRole;
    functions: UserFunction[];
  };
};

export type TeamAccessResult =
  | { access: TeamAccess; error?: never; status?: never }
  | { access?: never; error: Output; status: number };

const resolveProfileForTeamAccess = cache(async (supabaseId: string) => {
  return prisma.profile.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      email: true,
      fullName: true,
      activeTeamId: true,
      isMaster: true,
      managerId: true,
      timezone: true,
      deletedAt: true,
    },
  });
});

const resolveTeamMembershipForAccess = cache(async (teamId: string, profileId: string) => {
  return prisma.teamMember.findFirst({
    where: {
      teamId,
      profileId,
      team: { deletedAt: null },
    },
    select: {
      role: true,
      functions: true,
      canCreateAccountUsers: true,
      canManageAccountTeams: true,
      canTransferAccountLeads: true,
      canViewAllTeams: true,
      team: {
        select: {
          masterId: true,
          deletedAt: true,
          master: {
            select: {
              sponsorMasterId: true,
            },
          },
        },
      },
    },
  });
});

const resolveTeamForSponsorAccess = cache(async (teamId: string) => {
  return prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    select: {
      masterId: true,
      deletedAt: true,
      master: {
        select: {
          sponsorMasterId: true,
        },
      },
    },
  });
});

async function resolveTeamAccountAccess(profileId: string, teamId: string): Promise<TeamAccessResult | null> {
  const output = await accountAccessDecisionUseCase.execute({ profileId, teamId });
  const decision = output.result as AccountAccessDecision | null;
  if (output.isValid && decision?.state === "allowed") {
    return null;
  }

  const message = decision?.state === "restricted" && decision.reason === "banned"
    ? ACCOUNT_MASTER_BANNED_MESSAGE
    : decision?.state === "restricted" && decision.isBillingOwner
      ? "O acesso desta conta está pausado. Entre em contato com o time de assinaturas."
      : "O acesso desta conta está pausado. Avise o administrador desta conta para que ele entre em contato com o time de assinaturas.";

  return {
    error: new Output(false, [], [message], null),
    status: 403,
  };
}

export async function getTeamAccess(request: NextRequest): Promise<TeamAccessResult> {
  const supabaseId = request.headers.get("x-supabase-user-id");
  if (!supabaseId) {
    return {
      error: new Output(false, [], ["ID do usuário é obrigatório"], null),
      status: 401,
    };
  }

  const profile = await resolveProfileForTeamAccess(supabaseId);

  if (!profile) {
    return {
      error: new Output(false, [], ["Perfil não encontrado"], null),
      status: 404,
    };
  }

  if (profile.deletedAt) {
    return {
      error: new Output(false, [], ["Conta desativada"], null),
      status: 403,
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(teamId)) {
    return {
      error: new Output(false, [], ["teamId inválido"], null),
      status: 400,
    };
  }

  const teamMember = await resolveTeamMembershipForAccess(teamId, profile.id);

  if (!teamMember) {
    const teamForSponsor = await resolveTeamForSponsorAccess(teamId);
    const sponsorMasterId = teamForSponsor?.master.sponsorMasterId;
    if (!teamForSponsor || sponsorMasterId !== profile.id) {
      return {
        error: new Output(false, [], ["Acesso negado para este time"], null),
        status: 403,
      };
    }

    const accountMasterId = teamForSponsor.masterId;
    const accessDenied = await resolveTeamAccountAccess(profile.id, teamId);
    if (accessDenied) {
      return accessDenied;
    }

    return {
      access: {
        supabaseId,
        teamId,
        profileId: profile.id,
        profileEmail: profile.email,
        profileName: profile.fullName,
        isMaster: false,
        managerId: accountMasterId,
        canCreateAccountUsers: false,
        canManageAccountTeams: true,
        canTransferAccountLeads: false,
        canViewAllTeams: false,
        userTimezone: resolveTimezone(profile.timezone),
        teamMember: {
          role: "backoffice" as UserRole,
          functions: [] as UserFunction[],
        },
      },
    };
  }

  const accountMasterId = teamMember.team.masterId;
  const accessDenied = await resolveTeamAccountAccess(profile.id, teamId);
  if (accessDenied) {
    return accessDenied;
  }

  const resolvedCanViewAllTeams =
    (teamMember.role === "manager" || teamMember.role === "backoffice") &&
    teamMember.canViewAllTeams === true;

  return {
    access: {
      supabaseId,
      teamId,
      profileId: profile.id,
      profileEmail: profile.email,
      profileName: profile.fullName,
      isMaster: accountMasterId === profile.id,
      managerId: accountMasterId,
      canCreateAccountUsers:
        teamMember.role === "manager" && teamMember.canCreateAccountUsers === true,
      canManageAccountTeams:
        teamMember.role === "manager" && teamMember.canManageAccountTeams === true,
      canTransferAccountLeads:
        (teamMember.role === "manager" || teamMember.role === "backoffice") &&
        teamMember.canTransferAccountLeads === true,
      canViewAllTeams: resolvedCanViewAllTeams,
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

export function hasDelegatedLeadTransferAccess(access: TeamAccess) {
  return access.isMaster || access.canTransferAccountLeads;
}
