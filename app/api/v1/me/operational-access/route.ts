import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { backofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    console.info("[MeOperationalAccessRoute][GET] iniciado");
    const teamResult = await getTeamAccess(request);
    if (teamResult.error) {
      return NextResponse.json(teamResult.error, { status: teamResult.status });
    }

    const access = teamResult.access;
    const result = await backofficeOperationalAccessService.resolveOperationalAccess(
      access.profileId,
      access.teamId
    );

    return NextResponse.json(new Output(true, [], [], result), { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[MeOperationalAccessRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
