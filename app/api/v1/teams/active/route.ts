import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { isAccountSubscriptionActive } from "@/lib/subscription/isAccountSubscriptionActive";
import {
  ACCOUNT_MASTER_BANNED_MESSAGE,
  isAccountMasterBanned,
} from "@/lib/account/isAccountMasterBanned";
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
          select: { masterId: true },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        new Output(false, [], ["User is not a member of this team"], null),
        { status: 403 }
      );
    }

    const accountSubscriptionActive = await isAccountSubscriptionActive(membership.team.masterId);
    if (!accountSubscriptionActive) {
      return NextResponse.json(
        new Output(
          false,
          [],
          ["A assinatura desta conta está inativa. Entre em contato com o administrador."],
          null
        ),
        { status: 403 }
      );
    }

    if (await isAccountMasterBanned(membership.team.masterId)) {
      return NextResponse.json(
        new Output(false, [], [ACCOUNT_MASTER_BANNED_MESSAGE], null),
        { status: 403 }
      );
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { activeTeamId: teamId }
    });

    return NextResponse.json(
      new Output(true, ["Active team updated"], [], { activeTeamId: teamId }),
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
