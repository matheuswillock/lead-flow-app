import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { leadDocumentRequestUseCase } from "@/app/api/useCases/leads/leadDocumentRequestUseCaseFactory";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        new Output(false, [], ["Não autorizado"], null),
        { status: 401 }
      );
    }

    const output = await leadDocumentRequestUseCase.processReminders();
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

export const dynamic = "force-dynamic";
