import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { meOperationalAccessUseCase } from "@/app/api/useCases/meOperationalAccess/MeOperationalAccessUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  await connection();

  try {
    console.info("[MeOperationalAccessRoute][GET] iniciado");
    const teamResult = await getTeamAccess(request);
    if (teamResult.error) {
      return NextResponse.json(teamResult.error, { status: teamResult.status });
    }

    const access = teamResult.access;
    const output = await meOperationalAccessUseCase.resolve(access.profileId, access.teamId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[MeOperationalAccessRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
