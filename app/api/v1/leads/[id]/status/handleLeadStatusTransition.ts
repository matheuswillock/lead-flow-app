"use server";

import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { invalidateLeadCache, invalidateTeamCalendarCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import type {
  LeadStatusTransitionMode,
  UpdateLeadStatusTriggerInput,
} from "@/app/api/useCases/leads/ILeadUseCase";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

const isTransitionConflict = (output: Output): boolean => {
  const transition = output?.result && typeof output.result === "object"
    ? (output.result as { transition?: { allowed?: boolean; blockerType?: string } }).transition
    : null;
  return !!transition && transition.allowed === false && transition.blockerType !== "validation_error";
};

export type HandleLeadStatusTransitionOptions = {
  defaultMode: LeadStatusTransitionMode;
  allowBodyMode?: boolean;
  logPrefix: string;
};

export async function handleLeadStatusTransition(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
  options: HandleLeadStatusTransitionOptions
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = await request.json().catch(() => null);
    const status = body?.targetStatus ?? body?.status;
    const trigger = (body?.trigger ?? undefined) as UpdateLeadStatusTriggerInput | undefined;
    const mode: LeadStatusTransitionMode =
      options.allowBodyMode && body?.mode === "validate"
        ? "validate"
        : options.defaultMode;

    if (!status || !Object.values(LeadStatus).includes(status)) {
      const output = new Output(false, [], ["Status inválido"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    if (!id) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, teamId: true, closerId: true, status: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const teamMember = teamAccess.access.teamMember;
    const hasBaseAccess = hasLeadAccess(teamMember);
    const isAssignedCloser = !!lead.closerId && lead.closerId === teamAccess.access.profileId;
    const canUseCloserFallback =
      teamMember.functions?.includes("CLOSER") && (teamAccess.access.isMaster || isAssignedCloser);

    if (!hasBaseAccess && !canUseCloserFallback) {
      const output = new Output(
        false,
        [],
        ["Acesso negado: somente SDR/manager ou o closer do lead pode atualizar o status."],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const output = await leadUseCase.updateLeadStatus(
      teamAccess.access.supabaseId,
      id,
      status,
      trigger,
      mode
    );
    if (output.isValid && mode !== "validate") {
      const teamId = teamAccess.access.teamId;
      invalidateLeadCache({ leadId: id, teamId });
      if (status === "scheduled" || lead.status === "scheduled") {
        invalidateTeamCalendarCache({ teamId, leadId: id });
      }
    }
    const responseStatus = output.isValid ? 200 : isTransitionConflict(output) ? 409 : 400;
    return NextResponse.json(output, { status: responseStatus });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`[${options.logPrefix}] Erro ao atualizar status do lead:`, error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
