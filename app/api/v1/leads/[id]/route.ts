import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../../useCases/profiles/ProfileUseCase";
import { UpdateLeadRequestSchema } from "../DTO/requestToUpdateLead";
import { Output } from "@/lib/output";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function GET(
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

    const output = await leadUseCase.getLeadById(supabaseId, params.id);
    const status = output.isValid ? 200 : (output.errorMessages.includes("Lead não encontrado") ? 404 : 400);
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao buscar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function PUT(
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
    
    let validatedData;
    try {
      validatedData = UpdateLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadUseCase.updateLead(supabaseId, params.id, validatedData);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao atualizar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function DELETE(
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

    const output = await leadUseCase.deleteLead(supabaseId, params.id);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao excluir lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}