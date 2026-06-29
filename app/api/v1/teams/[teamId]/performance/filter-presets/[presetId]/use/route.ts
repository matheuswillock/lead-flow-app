import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamFilterPresetsUseCase } from "@/app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; presetId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, presetId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const output = await teamFilterPresetsUseCase.markAsUsed(
      teamId,
      teamAccess.access.profileId,
      presetId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PerformanceFilterPresetsRoute][USE] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao marcar preset como usado"], null),
      { status: 500 }
    );
  }
}
