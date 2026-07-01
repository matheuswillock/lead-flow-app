import type { NextRequest } from "next/server";
import { cache } from "react";
import { UserFunction, UserRole } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { isManagerLikeRole } from "@/lib/roles";
import { resolveTimezone } from "@/lib/dates";
import { isAccountSubscriptionActive } from "@/lib/subscription/isAccountSubscriptionActive";
import {
  ACCOUNT_MASTER_BANNED_MESSAGE,
  isAccountMasterBanned,
} from "@/lib/account/isAccountMasterBanned";

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
    },
  });
});

const resolveTeamMembershipForAccess = cache(async (teamId: string, profileId: string) => {
  return prisma.teamMember.findUnique({
    where: {
      teamId_profileId: {
        teamId,
        profileId,
      },
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
  return prisma.team.findUnique({
    where: { id: teamId },
    select: {
      masterId: true,
      master: {
        select: {
          sponsorMasterId: true,
        },
      },
    },
  });
});

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
    const accountSubscriptionActive = await isAccountSubscriptionActive(accountMasterId);
    if (!accountSubscriptionActive) {
      return {
        error: new Output(
          false,
          [],
          ["A assinatura desta conta está inativa. Entre em contato com o administrador."],
          null
        ),
        status: 403,
      };
    }

    if (await isAccountMasterBanned(accountMasterId)) {
      return {
        error: new Output(false, [], [ACCOUNT_MASTER_BANNED_MESSAGE], null),
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
  const accountSubscriptionActive = await isAccountSubscriptionActive(accountMasterId);

  if (!accountSubscriptionActive) {
    return {
      error: new Output(
        false,
        [],
        ["A assinatura desta conta está inativa. Entre em contato com o administrador."],
        null
      ),
      status: 403,
    };
  }

  if (await isAccountMasterBanned(accountMasterId)) {
    return {
      error: new Output(false, [], [ACCOUNT_MASTER_BANNED_MESSAGE], null),
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
      isMaster: accountMasterId === profile.id,
      managerId: accountMasterId,
      canCreateAccountUsers:
        teamMember.role === "manager" && teamMember.canCreateAccountUsers === true,
      canManageAccountTeams:
        teamMember.role === "manager" && teamMember.canManageAccountTeams === true,
      canTransferAccountLeads:
        (teamMember.role === "manager" || teamMember.role === "backoffice") &&
        teamMember.canTransferAccountLeads === true,
      canViewAllTeams:
        (teamMember.role === "manager" || teamMember.role === "backoffice") &&
        teamMember.canViewAllTeams === true,
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
