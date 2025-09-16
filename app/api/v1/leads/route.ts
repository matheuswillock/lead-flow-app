import { NextRequest, NextResponse } from "next/server";
import { LeadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "../../useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "../../useCases/profiles/ProfileUseCase";
import { CreateLeadRequestSchema } from "./DTO/requestToCreateLead";
import { Output } from "@/lib/output";
import { LeadStatus } from "@prisma/client";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extrair supabaseId dos headers ou body
    const supabaseId = request.headers.get('x-supabase-user-id') || body.supabaseId;
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    let validatedData;
    try {
      validatedData = CreateLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadUseCase.createLead(supabaseId, validatedData);
    const status = output.isValid ? 201 : 400;
    return NextResponse.json(output, { status });

  } catch (error) {
    console.error("Erro ao criar lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Extrair supabaseId dos headers
    const supabaseId = request.headers.get('x-supabase-user-id');
    
    if (!supabaseId) {
      const output = new Output(false, [], ["ID do usuário é obrigatório"], null);
      return NextResponse.json(output, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as LeadStatus | null;
    const assignedTo = searchParams.get('assignedTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const options = {
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      page,
      limit,
      ...(search && { search }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
    };

    const output = await leadUseCase.getLeadsByManager(supabaseId, options);
    return NextResponse.json(output);

  } catch (error) {
    console.error("Erro ao buscar leads:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}