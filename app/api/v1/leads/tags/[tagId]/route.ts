import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import { leadTagUseCase } from "@/app/api/useCases/leads/LeadTagUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { tagId } = await params;
    if (!tagId) {
      const output = new Output(false, [], ["ID da tag é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadTagUseCase.deleteTeamTag(teamAccess.access.teamId, tagId);
    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrada")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagByIdRoute][DELETE] Erro ao remover tag:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
