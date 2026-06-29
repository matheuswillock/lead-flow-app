import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

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
