import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { FilterPresetScope } from "@prisma/client";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamFilterPresetsUseCase } from "@/app/api/useCases/teamFilterPresets/TeamFilterPresetsUseCase";
import type { TeamFilterPresetInput } from "@/app/api/useCases/teamFilterPresets/ITeamFilterPresetsUseCase";
import { invalidateTeamFilterPresetsCache } from "@/lib/cache/invalidation";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const visibilitySchema = z.enum(["private", "team"]);

export const createFilterPresetSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome muito longo"),
  description: z.string().trim().max(240, "Descrição muito longa").nullable().optional(),
  queryJson: z.record(z.string(), z.unknown()),
  visibility: visibilitySchema.optional(),
});

export const updateFilterPresetSchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(120).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    queryJson: z.record(z.string(), z.unknown()).optional(),
    visibility: visibilitySchema.optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.queryJson !== undefined ||
      value.visibility !== undefined,
    { message: "Informe ao menos um campo para atualizar" }
  );

function denyTeamMismatch(routeLabel: string, urlTeamId: string, accessTeamId: string) {
  console.error(`[${routeLabel}] teamId mismatch:`, { urlTeamId, accessTeamId });
  return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), {
    status: 403,
  });
}

export async function handleFilterPresetsList(
  request: NextRequest,
  params: Promise<{ teamId: string }>,
  scope: FilterPresetScope,
  routeLabel: string
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return denyTeamMismatch(routeLabel, teamId ?? "", teamAccess.access.teamId);
    }

    const output = await teamFilterPresetsUseCase.list(teamId, teamAccess.access.profileId, scope);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${routeLabel}][GET] Erro ao listar presets:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar filtros pré-definidos"], null),
      { status: 500 }
    );
  }
}

export async function handleFilterPresetsCreate(
  request: NextRequest,
  params: Promise<{ teamId: string }>,
  scope: FilterPresetScope,
  routeLabel: string
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
      scope,
      {
        ...parsed.data,
        queryJson: parsed.data.queryJson as TeamFilterPresetInput["queryJson"],
      }
    );
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({
        teamId,
        profileId: teamAccess.access.profileId,
        scope,
      });
    }
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${routeLabel}][POST] Erro ao criar preset:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao criar filtro pré-definido"], null),
      { status: 500 }
    );
  }
}

export async function handleFilterPresetUpdate(
  request: NextRequest,
  params: Promise<{ teamId: string; presetId: string }>,
  scope: FilterPresetScope,
  routeLabel: string
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

    const isManager = isManagerLikeRole(teamAccess.access.teamMember.role);
    const output = await teamFilterPresetsUseCase.update(
      teamId,
      teamAccess.access.profileId,
      presetId,
      parsed.data,
      isManager
    );
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({
        teamId,
        profileId: teamAccess.access.profileId,
        scope,
      });
    }
    const status = output.isValid ? 200 : output.errorMessages[0]?.includes("permissão") ? 403 : 404;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${routeLabel}][PATCH] Erro ao atualizar preset:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar filtro pré-definido"], null),
      { status: 500 }
    );
  }
}

export async function handleFilterPresetDelete(
  request: NextRequest,
  params: Promise<{ teamId: string; presetId: string }>,
  scope: FilterPresetScope,
  routeLabel: string
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

    const isManager = isManagerLikeRole(teamAccess.access.teamMember.role);
    const output = await teamFilterPresetsUseCase.remove(
      teamId,
      teamAccess.access.profileId,
      presetId,
      isManager
    );
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({
        teamId,
        profileId: teamAccess.access.profileId,
        scope,
      });
    }
    const status = output.isValid ? 200 : output.errorMessages[0]?.includes("permissão") ? 403 : 404;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${routeLabel}][DELETE] Erro ao remover preset:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover filtro pré-definido"], null),
      { status: 500 }
    );
  }
}

export async function handleFilterPresetUse(
  request: NextRequest,
  params: Promise<{ teamId: string; presetId: string }>,
  scope: FilterPresetScope,
  routeLabel: string
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

    const isManager = isManagerLikeRole(teamAccess.access.teamMember.role);
    const output = await teamFilterPresetsUseCase.markAsUsed(
      teamId,
      teamAccess.access.profileId,
      presetId,
      isManager
    );
    if (output.isValid) {
      invalidateTeamFilterPresetsCache({
        teamId,
        profileId: teamAccess.access.profileId,
        scope,
      });
    }
    const status = output.isValid ? 200 : output.errorMessages[0]?.includes("permissão") ? 403 : 404;
    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${routeLabel}][POST] Erro ao marcar preset como usado:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao marcar filtro pré-definido"], null),
      { status: 500 }
    );
  }
}
