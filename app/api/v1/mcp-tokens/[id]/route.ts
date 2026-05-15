import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { McpTokenUseCase } from "@/app/api/useCases/mcpToken/McpTokenUseCase";

const useCase = new McpTokenUseCase();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    const teamId = request.headers.get("x-team-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const { id } = await params;
    const output = await useCase.revokeToken(supabaseId, teamId, id);
    const status = output.isValid ? 200 : output.errorMessages.includes("Token não encontrado") ? 404 : 400;
    return NextResponse.json(output, { status });
  } catch (error) {
    console.error("[McpTokenByIdRoute][DELETE]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
