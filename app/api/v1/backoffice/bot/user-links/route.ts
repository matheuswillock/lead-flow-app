import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess";
import { backofficeBotChannelUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotChannelUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const access = await getBackofficeAccess(request);
    if (access.error) return NextResponse.json(access.error, { status: access.status });

    const { searchParams } = new URL(request.url);
    const output = await backofficeBotChannelUseCase.listUserLinks({
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: parsePositiveInt(searchParams.get("pageSize"), 20),
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BackofficeBotUserLinksRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
