import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamAutomationRulesUseCase } from "@/app/api/useCases/teamAutomations/TeamAutomationRulesUseCase";
import { createAutomationRuleSchema } from "@/lib/team-automation/validation";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import type { AutomationRuleInput } from "@/lib/team-automation/types";

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
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    const output = await teamAutomationRulesUseCase.list(teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamAutomationRulesRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao listar automações"], null),
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { teamId } = await params;
    if (!teamId || teamId !== teamAccess.access.teamId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para este time"], null),
        { status: 403 }
      );
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem criar automações"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createAutomationRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        ),
        { status: 400 }
      );
    }

    const output = await teamAutomationRulesUseCase.create(
      teamId,
      teamAccess.access.profileId,
      parsed.data as AutomationRuleInput
    );
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamAutomationRulesRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao criar automação"], null),
      { status: 500 }
    );
  }
}
