import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess";
import { backofficeBotChannelUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotChannelUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function POST(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });
    const denied = requireMasterAccess(access.access);
    if (denied) return denied;

    const output = await backofficeBotChannelUseCase.disconnectChannel();
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotChannelDisconnectRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
