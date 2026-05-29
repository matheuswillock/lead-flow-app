import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamFilterPresetsUseCase } from "@/app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase";
import type { TeamFilterPresetInput } from "@/app/api/useCases/teamFilterPresets/ITeamFilterPresetsUseCase";

const createFilterPresetSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome muito longo"),
  description: z.string().trim().max(240, "Descrição muito longa").nullable().optional(),
  queryJson: z.record(z.string(), z.unknown()),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      console.error("[TeamFilterPresetsRoute][GET] teamId mismatch:", { urlTeamId: teamId, accessTeamId: teamAccess.access.teamId });
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const output = await teamFilterPresetsUseCase.list(teamId, teamAccess.access.profileId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[TeamFilterPresetsRoute][GET] Erro ao listar presets:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar filtros pré-definidos"], null),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createFilterPresetSchema.safeParse(body);
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

    const output = await teamFilterPresetsUseCase.create(
      teamId,
      teamAccess.access.profileId,
      {
        ...parsed.data,
        queryJson: parsed.data.queryJson as TeamFilterPresetInput["queryJson"],
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    console.error("[TeamFilterPresetsRoute][POST] Erro ao criar preset:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao criar filtro pré-definido"], null),
      { status: 500 }
    );
  }
}
