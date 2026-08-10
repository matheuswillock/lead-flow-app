import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { processEmailContactRadarSyncOutboxUseCase } from "@/app/api/useCases/radar/ProcessEmailContactRadarSyncOutboxUseCase";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";

export const maxDuration = 300;

async function handleSyncEmailContactsCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 });
  }

  const result = await withCronAudit(
    {
      cronKey: "radar-sync-email-contacts",
      cronPath: "/api/v1/radar/cron/sync-email-contacts",
    },
    () => processEmailContactRadarSyncOutboxUseCase.execute(),
    {
      onFailure: getDefaultCronSlackCallback(),
    }
  );
  return NextResponse.json(result, { status: result.isValid ? 200 : 500 });
}

export async function GET(request: NextRequest) {
  try {
    return await handleSyncEmailContactsCron(request);
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarCronSyncEmailContactsRoute][GET]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de sync Radar de contatos"], null),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleSyncEmailContactsCron(request);
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarCronSyncEmailContactsRoute][POST]", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de sync Radar de contatos"], null),
      { status: 500 }
    );
  }
}
