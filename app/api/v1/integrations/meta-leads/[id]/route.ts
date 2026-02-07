import { NextRequest, NextResponse } from "next/server";
import { metaLeadIntegrationUseCase } from "@/app/api/useCases/integrations/MetaLeadIntegrationUseCase";
import { Output } from "@/lib/output";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const output = await metaLeadIntegrationUseCase.update(supabaseId, id, body);
    const status = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("Erro ao atualizar integração Meta:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
