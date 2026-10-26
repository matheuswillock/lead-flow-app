import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import {
  SET_ACTIVE_TEAM_ERRORS,
  setActiveTeamUseCase,
} from "@/app/api/useCases/activeTeam/SetActiveTeamUseCase";
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

    const output = await setActiveTeamUseCase.execute({ supabaseId, teamId });

    if (!output.isValid) {
      if (output.errorMessages.includes(SET_ACTIVE_TEAM_ERRORS.PROFILE_NOT_FOUND)) {
        return NextResponse.json(
          new Output(false, [], ["Profile not found"], null),
          { status: 404 }
        );
      }
      if (output.errorMessages.includes(SET_ACTIVE_TEAM_ERRORS.NOT_TEAM_MEMBER)) {
        return NextResponse.json(
          new Output(false, [], ["User is not a member of this team"], null),
          { status: 403 }
        );
      }
      if (output.errorMessages.includes(SET_ACTIVE_TEAM_ERRORS.ACCESS_UNRESOLVABLE)) {
        return NextResponse.json(
          new Output(false, [], ["Não foi possível resolver o acesso desta conta"], null),
          { status: 503 }
        );
      }
      return NextResponse.json(
        new Output(false, [], ["Não foi possível atualizar o time ativo"], null),
        { status: 500 }
      );
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Error in PUT /api/v1/teams/active:", error);
    return NextResponse.json(
      new Output(false, [], ["Internal server error"], null),
      { status: 500 }
    );
  }
}
