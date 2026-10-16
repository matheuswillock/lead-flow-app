import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { invalidatePublicFormBootstrapCache, invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import {
  MEETING_DURATION_OPTIONS,
  type MeetingDurationMinutes,
} from "@/app/api/domain/teamScheduleSettings/meetingDuration";
import { teamScheduleSettingsUseCase } from "@/app/api/useCases/teamScheduleSettings/TeamScheduleSettingsUseCase";

const updateSchema = z.object({
  durationMinutes: z.number().int().refine((value) => MEETING_DURATION_OPTIONS.includes(value as MeetingDurationMinutes), {
    message: "A duração deve ser de 5 a 60 minutos, em intervalos de 5.",
  }),
});

export function canManageScheduleSettings(access: { isMaster: boolean; teamMember: { role: string } }) {
  return access.isMaster || access.teamMember.role === "manager";
}

function forbiddenResponse() {
  return NextResponse.json(
    new Output(false, [], ["Apenas master ou manager podem configurar o agendamento do time."], null),
    { status: 403 }
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[TeamScheduleSettingsRoute][GET] Carregando configuração de agendamento.");
  try {
    const accessResult = await getTeamAccess(request);
    if (accessResult.error) return NextResponse.json(accessResult.error, { status: accessResult.status });

    const { teamId } = await params;
    if (teamId !== accessResult.access.teamId || !canManageScheduleSettings(accessResult.access)) {
      return forbiddenResponse();
    }

    const output = await teamScheduleSettingsUseCase.get(teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamScheduleSettingsRoute][GET] Erro inesperado:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno ao carregar configuração."], null), { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  console.info("[TeamScheduleSettingsRoute][PUT] Atualizando configuração de agendamento.");
  try {
    const accessResult = await getTeamAccess(request);
    if (accessResult.error) return NextResponse.json(accessResult.error, { status: accessResult.status });

    const { teamId } = await params;
    if (teamId !== accessResult.access.teamId || !canManageScheduleSettings(accessResult.access)) {
      return forbiddenResponse();
    }

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      );
    }

    const output = await teamScheduleSettingsUseCase.update({
      teamId,
      durationMinutes: parsed.data.durationMinutes as MeetingDurationMinutes,
    });
    if (output.isValid) {
      invalidateTeamCalendarCache({ teamId });
      invalidatePublicFormBootstrapCache({ teamId });
    }
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamScheduleSettingsRoute][PUT] Erro inesperado:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno ao atualizar configuração."], null), { status: 500 });
  }
}
