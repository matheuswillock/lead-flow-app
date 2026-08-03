import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";

const createRequestSchema = z.object({
  documents: z
    .array(z.string().min(1).max(200))
    .min(1, "Ao menos um documento é obrigatório")
    .max(20, "Máximo de 20 documentos por solicitação"),
  message: z.string().max(1000).optional(),
});

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

    const output = await leadDocumentRequestUseCase.listRequests(leadId, teamAccess.access.teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadDocumentRequestsRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
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
    const validation = createRequestSchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const output = await leadDocumentRequestUseCase.createRequest({
      leadId,
      teamId: teamAccess.access.teamId,
      profileId: teamAccess.access.profileId,
      documents: validation.data.documents,
      message: validation.data.message,
    });

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadDocumentRequestsRoute][POST] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
