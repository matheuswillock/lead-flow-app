import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function PATCH(
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

    const body = await request.json();
    const { operatorId } = body;

    if (!operatorId) {
      const output = new Output(false, [], ["ID do operador é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamAccess.access.teamId) {
      const output = new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
      return NextResponse.json(output, { status: 404 });
    }

    const operatorMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId: teamAccess.access.teamId,
          profileId: operatorId,
        },
      },
    });

    if (!operatorMembership) {
      const output = new Output(false, [], ["Operador não pertence a este time"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadUseCase.assignLeadToOperator(teamAccess.access.supabaseId, id, operatorId);
    const responseStatus = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status: responseStatus });

  } catch (error) {
    console.error("Erro ao atribuir lead ao operador:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
