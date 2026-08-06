import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { requestId } = await params;
    if (!requestId) {
      const output = new Output(false, [], ["ID da solicitação é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadDocumentRequestUseCase.resendEmail(requestId, teamAccess.access.teamId);

    if (!output.isValid) {
      const status = output.errorMessages.some((m) => m.includes("não encontrada")) ? 404 : 400;
      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadDocumentRequestResendRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
