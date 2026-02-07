import { NextRequest, NextResponse } from "next/server";
import { metaLeadIntegrationUseCase } from "@/app/api/useCases/integrations/MetaLeadIntegrationUseCase";
import { Output } from "@/lib/output";

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = request.headers.get("x-team-id") || searchParams.get("teamId");

    const output = await metaLeadIntegrationUseCase.listBySupabaseId(supabaseId, teamId);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao listar integrações Meta:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const body = await request.json();
    const output = await metaLeadIntegrationUseCase.create(supabaseId, body);
    const status = output.isValid ? 201 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao criar integração Meta:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
