import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamAutomationRulesUseCase } from "@/app/api/useCases/teamAutomations/TeamAutomationRulesUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId, ruleId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? "20"))
    );

    const output = await teamAutomationRulesUseCase.listRuns(teamId, ruleId, page, pageSize);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamAutomationRuleRunsRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar execuções"], null),
      { status: 500 }
    );
  }
}
