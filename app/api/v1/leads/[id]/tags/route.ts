import { NextRequest, NextResponse } from "next/server";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import { leadTagUseCase } from "@/app/api/useCases/leads/LeadTagUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadTagUseCase.listLeadTags(leadId, teamAccess.access.teamId);
    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result.result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagsByLeadRoute][GET] Erro ao listar tags do lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const body = await request.json();
    const { tagId } = body as { tagId?: string };

    if (!tagId) {
      const output = new Output(false, [], ["tagId é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const result = await leadTagUseCase.applyTagToLead(leadId, tagId, teamAccess.access.teamId);
    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result.result, { status: 201 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadTagsByLeadRoute][POST] Erro ao aplicar tag ao lead:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
