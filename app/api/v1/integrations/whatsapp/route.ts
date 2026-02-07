import { NextRequest, NextResponse } from "next/server";
import { whatsAppIntegrationUseCase } from "@/app/api/useCases/integrations/WhatsAppIntegrationUseCase";
import { Output } from "@/lib/output";

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = request.headers.get("x-team-id") || searchParams.get("teamId");

    const output = await whatsAppIntegrationUseCase.listBySupabaseId(supabaseId, teamId);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao listar integrações WhatsApp:", error);
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
    const output = await whatsAppIntegrationUseCase.create(supabaseId, body);
    const status = output.isValid ? 201 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao criar integração WhatsApp:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
