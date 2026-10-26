import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit";

const schema = z.object({
  teamId: z.string().uuid(),
  supabaseId: z.string().uuid().nullish(),
  closerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const validation = schema.safeParse(payload);

    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const { teamId, supabaseId, closerId, date } = validation.data;

    // SPEC 40 A-E1/R40-9 (V3): a SPEC declara este endpoint "protegido pela
    // A-E1" — sem teto, dá para varrer a agenda de todos os closers do time
    // sem limite.
    const rate = await consumePublicFormRateLimit(
      `lead-form-availability:${teamId}:${publicFormRequestFingerprint(request)}`,
      { limit: 60, windowMs: 60_000 }
    );
    if (!rate.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Recebemos muitos envios agora. Tente de novo em alguns minutos."], null),
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const output = await publicLeadFormUseCase.getCloserAvailability(
      teamId,
      closerId,
      date,
      supabaseId ?? undefined
    );
    if (!output.isValid) {
      const normalizedErrors = output.errorMessages.join(" ").toLowerCase();
      const status =
        normalizedErrors.includes("não pertence ao time") || normalizedErrors.includes("nao pertence ao time")
          ? 403
          : normalizedErrors.includes("não encontrado") || normalizedErrors.includes("nao encontrado")
            ? 404
            : 400;

      return NextResponse.json(output, { status });
    }

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[IntegrationAvailabilityRoute][POST] Erro ao buscar disponibilidade:", error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
