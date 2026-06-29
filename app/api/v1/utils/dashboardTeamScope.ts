import type { NextRequest } from "next/server";
import { prisma } from "@/app/api/infra/data/prisma";
import { Output } from "@/lib/output";
import { isManagerLikeRole } from "@/lib/roles";
import type { TeamAccess } from "./teamAccess";

export type DashboardTeamScope = "active" | "all";

export function parseDashboardTeamScope(value: string | null): DashboardTeamScope {
  return value === "all" ? "all" : "active";
}

export function getDashboardTeamScopeFromRequest(request: NextRequest): DashboardTeamScope {
  const url = new URL(request.url);
  return parseDashboardTeamScope(url.searchParams.get("teamScope"));
}

export type ResolvedDashboardTeamScope =
  | { teamIds: string[]; masterId: string; teamScope: DashboardTeamScope }
  | { error: Output; status: number };

export async function resolveDashboardTeamScope(
  access: TeamAccess,
  teamScope: DashboardTeamScope,
): Promise<ResolvedDashboardTeamScope> {
  const activeTeam = await prisma.team.findUnique({
    where: { id: access.teamId },
    select: { masterId: true },
  });

  if (!activeTeam) {
    return {
      error: new Output(false, [], ["Time não encontrado"], null),
      status: 404,
    };
  }

  if (teamScope === "active") {
    return {
      teamIds: [access.teamId],
      masterId: activeTeam.masterId,
      teamScope: "active",
    };
  }

  if (!isManagerLikeRole(access.teamMember.role)) {
    return {
      error: new Output(
        false,
        [],
        ["Acesso negado: apenas managers podem visualizar todos os times"],
        null,
      ),
      status: 403,
    };
  }

  const accountTeams = await prisma.team.findMany({
    where: { masterId: activeTeam.masterId },
    select: { id: true },
  });

  return {
    teamIds: accountTeams.map((team) => team.id),
    masterId: activeTeam.masterId,
    teamScope: "all",
  };
}
