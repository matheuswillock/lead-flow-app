import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamFilterPresetsUseCase } from "@/app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase";
import type { TeamFilterPresetUpdateInput } from "@/app/api/useCases/teamFilterPresets/ITeamFilterPresetsUseCase";
import { invalidateTeamFilterPresetsCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const updateFilterPresetSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    queryJson: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.description !== undefined || value.queryJson !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

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
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const updateInput: TeamFilterPresetUpdateInput = {};
    if (parsed.data.name !== undefined) updateInput.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateInput.description = parsed.data.description;
    if (parsed.data.queryJson !== undefined) {
      updateInput.queryJson = parsed.data.queryJson as TeamFilterPresetUpdateInput["queryJson"];
    }

    const output = await teamFilterPresetsUseCase.update(
      teamId,
      teamAccess.access.profileId,
      presetId,
      updateInput
    );
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({ teamId, profileId: teamAccess.access.profileId });
    }
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamFilterPresetByIdRoute][PATCH] Erro ao atualizar preset:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar filtro pré-definido"], null),
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
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({ teamId, profileId: teamAccess.access.profileId });
    }
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamFilterPresetByIdRoute][DELETE] Erro ao remover preset:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover filtro pré-definido"], null),
      { status: 500 }
    );
  }
}
