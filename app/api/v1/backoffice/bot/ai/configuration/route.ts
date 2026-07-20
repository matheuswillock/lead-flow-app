import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotAiConfigurationUseCase } from "@/app/api/useCases/backofficeBotAi/BackofficeBotAiUseCases";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const output = await backofficeBotAiConfigurationUseCase.get();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotAiConfigurationRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessResult = await getBackofficeAccess(request);
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const output = await backofficeBotAiConfigurationUseCase.patch(
      accessResult.access.profileId,
      accessResult.access.fullAccess,
      body
    );
    return NextResponse.json(output, {
      status: output.isValid ? 200 : output.errorMessages[0]?.includes("MASTER") ? 403 : 400,
    });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotAiConfigurationRoute][PATCH]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
