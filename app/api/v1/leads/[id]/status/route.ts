import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../../useCases/profiles/ProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus } from "@prisma/client";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extrair supabaseId dos headers
    const supabaseId = request.headers.get('x-supabase-user-id');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(LeadStatus).includes(status)) {
      const output = new Output(false, [], ["Status inválido"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadUseCase.updateLeadStatus(supabaseId, params.id, status);
    const responseStatus = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status: responseStatus });

  } catch (error) {
    console.error("Erro ao atualizar status do lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}