import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotHostUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotHostUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function POST(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const output = await backofficeBotHostUseCase.applyEnv({
      profileId: accessResult.access.profileId,
      fullAccess: accessResult.access.fullAccess,
    });
    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages[0]?.includes("MASTER") ? 403 : 400,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostApplyRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
