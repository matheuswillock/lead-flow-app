import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { McpTokenUseCase } from "@/app/api/useCases/mcpToken/McpTokenUseCase";
import { z } from "zod";

const useCase = new McpTokenUseCase();

const CreateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    const teamId = request.headers.get("x-team-id");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], [parsed.error.message], null), { status: 400 });
    }

    const output = await useCase.createToken(supabaseId, teamId, parsed.data.label);
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    console.error("[McpTokensRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseId = request.headers.get("x-supabase-user-id");
    const teamId =
      request.headers.get("x-team-id") ||
      new URL(request.url).searchParams.get("teamId");
    if (!supabaseId) {
      return NextResponse.json(new Output(false, [], ["ID do usuário é obrigatório"], null), { status: 401 });
    }
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const output = await useCase.listTokens(supabaseId, teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[McpTokensRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}
