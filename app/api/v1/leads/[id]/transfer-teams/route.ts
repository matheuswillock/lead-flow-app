import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { TransferLeadBetweenTeamsRequestSchema } from "../../DTO/requestToTransferLeadBetweenTeams";
import { Output } from "@/lib/output";
import { getTeamAccess, isManagerOrMaster } from "@/app/api/v1/utils/teamAccess";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { access } = teamAccess;
    if (!isManagerOrMaster(access)) {
      const output = new Output(false, [], ["Acesso negado: apenas managers e masters podem transferir leads entre times."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    const validation = TransferLeadBetweenTeamsRequestSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { id } = await params;
    const output = await leadUseCase.transferLeadBetweenTeams(access.supabaseId, access.teamId, id, validation.data);

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[TransferLeadBetweenTeamsRoute][POST] Erro interno:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
