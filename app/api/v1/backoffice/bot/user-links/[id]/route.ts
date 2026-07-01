import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotChannelUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotChannelUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await getBackofficeAccess(_request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const { id } = await params;
    const output = await backofficeBotChannelUseCase.revokeUserLink(id);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotUserLinkRoute][DELETE]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
