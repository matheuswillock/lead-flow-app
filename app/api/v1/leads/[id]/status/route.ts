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
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
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
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
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
    const responseStatus = output.isValid ? 200 : needsConfirmation ? 409 : 400;
    return NextResponse.json(output, { status: responseStatus });

  } catch (error) {
    console.error("[LeadStatusRoute][PUT] Erro ao atualizar status do lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
