import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { accountAccessDecisionUseCase } from "@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function PUT(request: NextRequest) {
  try {
    const supabaseIdHeader = request.headers.get("x-supabase-user-id");
    const supabaseIdLegacy = request.headers.get("supabaseid");
    const supabaseIdQuery = new URL(request.url).searchParams.get("supabaseId");
    const supabaseId = supabaseIdHeader || supabaseIdLegacy || supabaseIdQuery;

    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Supabase ID is required"], null),
        { status: 400 }
      );
    }

    const body = await request.json();
    const teamId = body?.teamId as string | undefined;

    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["teamId is required"], null),
        { status: 400 }
      );
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(teamId)) {
      return NextResponse.json(
        new Output(false, [], ["teamId inválido"], null),
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true }
    });

    if (!profile) {
      return NextResponse.json(
        new Output(false, [], ["Profile not found"], null),
        { status: 404 }
      );
    }

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id
        }
      },
      select: {
        team: {
          select: { masterId: true, deletedAt: true },
        },
      },
    });

    if (!membership || membership.team.deletedAt) {
      const sponsoredTeam = await prisma.team.findFirst({
        where: { id: teamId, deletedAt: null },
        select: {
          masterId: true,
          master: { select: { sponsorMasterId: true } },
        },
      });

      if (!sponsoredTeam || sponsoredTeam.master.sponsorMasterId !== profile.id) {
        return NextResponse.json(
          new Output(false, [], ["User is not a member of this team"], null),
          { status: 403 }
        );
      }
    }

    const accountAccessOutput = await accountAccessDecisionUseCase.execute({
      profileId: profile.id,
      teamId,
    });
    if (!accountAccessOutput.isValid || !accountAccessOutput.result) {
      return NextResponse.json(
        new Output(false, [], ["Não foi possível resolver o acesso desta conta"], null),
        { status: 503 }
      );
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeTeamId: teamId }
    });

    return NextResponse.json(
      new Output(true, ["Active team updated"], [], {
        activeTeamId: teamId,
        accountAccessDecision: accountAccessOutput.result,
      }),
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Error in PUT /api/v1/teams/active:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
