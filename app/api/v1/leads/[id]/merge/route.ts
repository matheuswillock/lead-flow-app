import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { MergeLeadRequestSchema } from "../../DTO/requestToMergeLead";
import { mergeLeadsUseCase } from "@/app/api/useCases/leads/MergeLeadsUseCase";
import { invalidateLeadCache } from "@/lib/cache/invalidation";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(
        false,
        [],
        ["Acesso negado: função SDR necessária para visualizar leads."],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    if (!teamAccess.access.isMaster && !isManagerLikeRole(teamAccess.access.teamMember.role)) {
      const output = new Output(
        false,
        [],
        ["Apenas gestores podem mesclar leads."],
        null
      );
      return NextResponse.json(output, { status: 403 });
    }

    const body = await request.json();
    let validatedData;
    try {
      validatedData = MergeLeadRequestSchema.parse(body);
    } catch (validationError) {
      const output = new Output(false, [], [(validationError as Error).message], null);
      return NextResponse.json(output, { status: 400 });
    }

    const { id: targetLeadId } = await params;
    const output = await mergeLeadsUseCase.execute(teamAccess.access, {
      targetLeadId,
      sourceLeadId: validatedData.sourceLeadId,
    });

    if (output.isValid) {
      invalidateLeadCache({
        leadId: targetLeadId,
        teamId: teamAccess.access.teamId,
      });
      invalidateLeadCache({
        leadId: validatedData.sourceLeadId,
        teamId: teamAccess.access.teamId,
      });
    }

    const responseStatus = output.isValid ? 200 : 400;
    return NextResponse.json(output, { status: responseStatus });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[LeadMergeRoute][POST]", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
