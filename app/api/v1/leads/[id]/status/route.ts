import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import type { UpdateLeadStatusTriggerInput } from "@/app/api/useCases/leads/ILeadUseCase";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const body = await request.json().catch(() => null);
    const status = body?.status;
    const trigger = (body?.trigger ?? undefined) as UpdateLeadStatusTriggerInput | undefined;

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
      select: { id: true, teamId: true, closerId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const teamMember = teamAccess.access.teamMember;
    const hasBaseAccess = hasLeadAccess(teamMember);
    const isAssignedCloser =
      !!lead.closerId && lead.closerId === teamAccess.access.profileId;
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
      trigger
    );
    const needsConfirmation = !!(
      output.result &&
      typeof output.result === "object" &&
      "requiresConfirmation" in output.result &&
      (output.result as { requiresConfirmation?: boolean }).requiresConfirmation
    );
    const requiresMeetingHeald = !!(
      output.result &&
      typeof output.result === "object" &&
      "requiresMeetingHeald" in output.result &&
      (output.result as { requiresMeetingHeald?: boolean }).requiresMeetingHeald
    );
    const requiresSalesInfo = !!(
      output.result &&
      typeof output.result === "object" &&
      "requiresSalesInfo" in output.result &&
      (output.result as { requiresSalesInfo?: boolean }).requiresSalesInfo
    );

    const responseStatus = output.isValid
      ? 200
      : needsConfirmation || requiresMeetingHeald || requiresSalesInfo
        ? 409
        : 400;
    return NextResponse.json(output, { status: responseStatus });

  } catch (error) {
    console.error("[LeadStatusRoute][PUT] Erro ao atualizar status do lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
