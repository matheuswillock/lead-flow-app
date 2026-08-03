import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import { leadTagUseCase } from "@/app/api/useCases/leads/LeadTagUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { id: leadId, tagId } = await params;
    if (!leadId || !tagId) {
      const output = new Output(false, [], ["ID do lead e ID da tag são obrigatórios"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadTagUseCase.removeTagFromLead(leadId, tagId, teamAccess.access.teamId);
    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagAssignmentRoute][DELETE] Erro ao remover tag do lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
