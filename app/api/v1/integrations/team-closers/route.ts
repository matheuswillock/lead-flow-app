import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const url = new URL(request.url);
    const supabaseId = url.searchParams.get("supabaseId");
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        new Output(false, [], ["teamId é obrigatório"], null),
        { status: 400 }
      );
    }

    // SPEC 40 A-E1/R40-9 (V3)
    const rate = await consumePublicFormRateLimit(
      `lead-form-team-closers:${teamId}:${publicFormRequestFingerprint(request)}`,
      { limit: 60, windowMs: 60_000 }
    );
    if (!rate.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Recebemos muitos envios agora. Tente de novo em alguns minutos."], null),
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const output = await publicLeadFormUseCase.getTeamClosers(teamId, supabaseId ?? undefined);
    if (!output.isValid) {
      const normalizedErrors = output.errorMessages.join(" ").toLowerCase();
      const status =
        normalizedErrors.includes("não encontrado") || normalizedErrors.includes("nao encontrado")
          ? 404
          : normalizedErrors.includes("não pertence ao time") || normalizedErrors.includes("nao pertence ao time")
            ? 404
            : 400;

      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[IntegrationTeamClosersRoute][GET] Erro ao listar closers:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao listar closers do time"], null),
      { status: 500 }
    );
  }
}
