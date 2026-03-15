import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";

async function getTeamMasterId(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { masterId: true },
  });

  return team?.masterId ?? null;
}

/**
 * GET /api/v1/manager/[supabaseId]/users/[userId]/teams
 * Lista outros times do usuário (exceto o time ativo)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string; userId: string }> }
) {
  try {
    const requesterId = request.headers.get("x-supabase-user-id");
    const { supabaseId, userId } = await params;

    if (!requesterId) {
      const output = new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    if (requesterId !== supabaseId) {
      const output = new Output(false, [], ["Você só pode acessar seus próprios recursos"], null);
      return NextResponse.json(output, { status: 403 });
    }

    if (!userId) {
      const output = new Output(false, [], ["userId é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const teamAccess = await getTeamAccess(request);
    if ("error" in teamAccess) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, teamMember } = teamAccess.access;
    if (!isManagerLikeRole(teamMember.role)) {
      const output = new Output(false, [], ["Acesso negado. Apenas managers podem realizar esta operação"], null);
      return NextResponse.json(output, { status: 403 });
    }

    const masterId = await getTeamMasterId(teamId);
    if (!masterId) {
      const output = new Output(false, [], ["Time não encontrado"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const isMemberOfActiveTeam = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: userId,
        },
      },
      select: { id: true },
    });

    if (!isMemberOfActiveTeam) {
      const output = new Output(false, [], ["Usuário não encontrado no time"], null);
      return NextResponse.json(output, { status: 404 });
    }

    const memberships = await prisma.teamMember.findMany({
      where: {
        profileId: userId,
        team: { masterId },
      },
      select: {
        teamId: true,
        team: { select: { name: true } },
      },
      orderBy: { team: { name: "asc" } },
    });

    const otherMemberships = memberships.filter((membership) => membership.teamId !== teamId);
    if (!otherMemberships.length) {
      const output = new Output(true, [], [], { teams: [] });
      return NextResponse.json(output, { status: 200 });
    }

    const otherTeamIds = otherMemberships.map((membership) => membership.teamId);

    const leadsCounts = await prisma.lead.groupBy({
      by: ["teamId"],
      where: {
        teamId: { in: otherTeamIds },
        assignedTo: userId,
      },
      _count: { _all: true },
    });

    const meetingsCounts = await prisma.lead.groupBy({
      by: ["teamId"],
      where: {
        teamId: { in: otherTeamIds },
        closerId: userId,
        meetingHeald: "yes",
      },
      _count: { _all: true },
    });

    const leadsMap = new Map<string, number>(
      leadsCounts.map((item) => [item.teamId as string, item._count._all])
    );
    const meetingsMap = new Map<string, number>(
      meetingsCounts.map((item) => [item.teamId as string, item._count._all])
    );

    const teams = otherMemberships.map((membership) => ({
      id: membership.teamId,
      name: membership.team.name,
      leadsCount: leadsMap.get(membership.teamId) ?? 0,
      meetingsCount: meetingsMap.get(membership.teamId) ?? 0,
    }));

    const output = new Output(true, [], [], { teams });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error("Erro ao listar times do usuário:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
