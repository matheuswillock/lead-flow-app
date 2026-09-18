import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { releaseEmailContactListQuarantineUseCase } from "@/app/api/useCases/email/ReleaseEmailContactListQuarantineUseCase";
import { isManagerLikeRole } from "@/lib/roles";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * Liberação explícita da quarentena do gate de importação. Restrita a
 * manager/owner: liberar assume o custo de reputação de enviar para uma
 * lista classificada como risco ALTO.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem liberar listas em quarentena"], null),
        { status: 403 }
      );
    }

    const output = await releaseEmailContactListQuarantineUseCase.execute(id, teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailContactListQuarantineReleaseRoute][POST]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao liberar a lista da quarentena"], null),
      { status: 500 }
    );
  }
}
