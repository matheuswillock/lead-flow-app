import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { teamAutomationRulesUseCase } from "@/app/api/useCases/teamAutomations/TeamAutomationRulesUseCase";
import { updateAutomationRuleSchema } from "@/lib/team-automation/validation";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import type { AutomationRuleUpdateInput } from "@/lib/team-automation/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
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

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem editar automações"], null),
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = updateAutomationRuleSchema.safeParse(body);
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

    const output = await teamAutomationRulesUseCase.update(
      teamId,
      ruleId,
      parsed.data as AutomationRuleUpdateInput
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamAutomationRuleRoute][PATCH] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao atualizar automação"], null),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; ruleId: string }> }
) {
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

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem excluir automações"], null),
        { status: 403 }
      );
    }

    const output = await teamAutomationRulesUseCase.remove(teamId, ruleId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TeamAutomationRuleRoute][DELETE] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao excluir automação"], null),
      { status: 500 }
    );
  }
}
