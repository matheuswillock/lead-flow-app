import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { releaseTeamSendingHealthUseCase } from "@/app/api/useCases/email/ReleaseTeamSendingHealthUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

/**
 * Liberação manual da trava de reputação pelo owner do time:
 * `paused` → `warned`. `suspended` só sai pelo backoffice — o use case recusa.
 */
export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const output = await releaseTeamSendingHealthUseCase.execute(teamAccess.access);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[EmailSendingHealthReleaseRoute][POST]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao liberar o envio do time"], null),
      { status: 500 }
    );
  }
}
