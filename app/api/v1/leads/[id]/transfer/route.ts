import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { TransferLeadRequestSchema } from "../../DTO/requestToTransferLead";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { invalidateLeadCache } from "@/lib/cache/invalidation";

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

    const body = await request.json();
    
    // Validar dados de entrada com Zod
    let validatedData;
    try {
      validatedData = TransferLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
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

    const previousTeamId = teamAccess.access.teamId;
    const output = await leadUseCase.transferLead(teamAccess.access.supabaseId, id, validatedData);

    if (output.isValid) {
      invalidateLeadCache({ leadId: id, teamId: previousTeamId });
    }
    const responseStatus = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status: responseStatus });

  } catch (error) {
    console.error("Erro na API de transferência de lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
