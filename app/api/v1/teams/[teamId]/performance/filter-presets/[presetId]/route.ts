import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamFilterPresetsUseCase } from "@/app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase";
import type { TeamFilterPresetInput } from "@/app/api/useCases/teamFilterPresets/ITeamFilterPresetsUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const updateFilterPresetSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(240).nullable().optional(),
  queryJson: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
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

    const body = await request.json().catch(() => null);
    const parsed = updateFilterPresetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((i) => i.message), null),
        { status: 400 }
      );
    }

    const output = await teamFilterPresetsUseCase.update(
      teamId,
      teamAccess.access.profileId,
      presetId,
      {
        ...parsed.data,
        queryJson: parsed.data.queryJson as TeamFilterPresetInput["queryJson"] | undefined,
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PerformanceFilterPresetsRoute][PATCH] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar preset"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const output = await teamFilterPresetsUseCase.remove(
      teamId,
      teamAccess.access.profileId,
      presetId
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[PerformanceFilterPresetsRoute][DELETE] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover preset"], null),
      { status: 500 }
    );
  }
}
