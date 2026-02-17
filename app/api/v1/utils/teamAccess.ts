import { NextRequest } from "next/server";
import { UserFunction, UserRole } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";

export type TeamAccess = {
  supabaseId: string;
  teamId: string;
  profileId: string;
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
    select: { id: true, activeTeamId: true },
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
    select: { role: true, functions: true },
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
      teamMember,
    },
  };
}

export function hasLeadAccess(teamMember: { role: UserRole; functions: UserFunction[] }) {
  if (teamMember.role === "manager") {
    return true;
  }

  return teamMember.functions?.includes("SDR");
}

export function hasLeadActivityAccess(teamMember: { role: UserRole; functions: UserFunction[] }) {
  if (teamMember.role === "manager") {
    return true;
  }

  return teamMember.functions?.includes("SDR") || teamMember.functions?.includes("CLOSER");
}
