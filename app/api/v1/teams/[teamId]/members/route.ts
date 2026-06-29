import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { invalidateTeamMembersCache } from "@/lib/cache/invalidation";
import { teamMembersUseCase } from "@/app/api/useCases/teamMembers/TeamMembersUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

const addMemberSchema = z.object({
  profileId: z.string().uuid(),
});

const removeMemberSchema = z.object({
  profileId: z.string().uuid(),
});

const listMembersFunctionSchema = z.enum(["SDR", "CLOSER"]);

function getSupabaseId(request: NextRequest) {
  return request.headers.get("x-supabase-user-id");
}

function resolveStatus(output: Output) {
  const messages = output.errorMessages.join(" ");

  if (messages.includes("Perfil não encontrado") || messages.includes("Time não encontrado")) {
    return 404;
  }
  if (messages.includes("não faz parte") || messages.includes("Apenas o master")) {
    return 403;
  }
  if (messages.includes("já pertence")) {
    return 409;
  }
  if (messages.includes("Erro interno")) {
    return 500;
  }
  return 400;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = getSupabaseId(request);
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const requestedFunctionParam = new URL(request.url).searchParams.get("function");
    let requestedFunction: z.infer<typeof listMembersFunctionSchema> | null = null;
    if (requestedFunctionParam) {
      const parsedFunction = listMembersFunctionSchema.safeParse(requestedFunctionParam.toUpperCase());
      if (!parsedFunction.success) {
        return NextResponse.json(
          new Output(false, [], ["Parâmetro function inválido. Use SDR ou CLOSER."], null),
          { status: 400 }
        );
      }
      requestedFunction = parsedFunction.data;
    }

    const output = await teamMembersUseCase.listMembers(supabaseId, teamId, requestedFunction);
    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamMembersRoute][GET] Erro ao listar membros do time:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar membros do time"], null),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = getSupabaseId(request);
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const parsed = addMemberSchema.safeParse(await request.json());
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const output = await teamMembersUseCase.addMember(supabaseId, teamId, parsed.data.profileId);
    if (output.isValid) {
      invalidateTeamMembersCache({ teamId });
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamMembersRoute][POST] Erro ao adicionar membro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao adicionar membro"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const supabaseId = getSupabaseId(request);
    if (!supabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null),
        { status: 401 }
      );
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const parsed = removeMemberSchema.safeParse(await request.json());
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const output = await teamMembersUseCase.removeMember(supabaseId, teamId, parsed.data.profileId);
    if (output.isValid) {
      invalidateTeamMembersCache({ teamId });
    }

    return NextResponse.json(output, { status: output.isValid ? 200 : resolveStatus(output) });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamMembersRoute][DELETE] Erro ao remover membro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao remover membro"], null),
      { status: 500 }
    );
  }
}
