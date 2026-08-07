import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit";
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        new Output(false, [], ["Não autorizado"], null),
        { status: 401 }
      );
    }

    const output = await withCronAudit(
      {
        cronKey: "document-request-reminders",
        cronPath: "/api/cron/document-request-reminders",
      },
      () => leadDocumentRequestUseCase.processReminders(),
      {
        onFailure: getDefaultCronSlackCallback(),
      }
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[DocumentRequestCronRoute][GET] Erro:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de lembretes"], null),
      { status: 500 }
    );
  }
}
