import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamMembersUseCase } from "@/app/api/useCases/teamMembers/TeamMembersUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const listSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId) {
      return NextResponse.json(new Output(false, [], ["Team ID é obrigatório"], null), { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = listSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], [parsed.error.issues[0]?.message ?? "Parâmetros inválidos"], null),
        { status: 400 }
      );
    }

    const output = await teamMembersUseCase.listTransferTargetsWithCtx(teamAccess.access, teamId, {
      query: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
    });

    if (!output.isValid) {
      const status = output.errorMessages.some((message) => message.includes("Acesso negado"))
        ? 403
        : 400;
      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamTransferTargetsRoute][GET] Erro ao listar destinos de transferência:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar destinos de transferência"], null),
      { status: 500 }
    );
  }
}
