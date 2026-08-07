import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output";
import { backofficeBotAuthUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotAuthUseCase";
import { getBotProductAccess } from "@/app/api/v1/bot/utils/getBotProductAccess";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBotProductAccess(request);
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status });
    }

    const output = await backofficeBotAuthUseCase.linkStatus(access.access.profileId);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotLinkStatusRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
