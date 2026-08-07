import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotHostUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotHostUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }

    const output = await backofficeBotHostUseCase.exportEnvFile({
      profileId: accessResult.access.profileId,
      fullAccess: accessResult.access.fullAccess,
    });

    const status = output.isValid
      ? 200
      : output.errorMessages[0]?.includes("MASTER")
        ? 403
        : 400;

    return NextResponse.json(output, { status });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotHostEnvFileRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
