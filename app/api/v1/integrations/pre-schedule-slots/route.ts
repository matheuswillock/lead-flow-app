import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";

const routePrefix = "[IntegrationPreScheduleSlotsRoute][GET]";

const QuerySchema = z.object({
  teamId: z.string().uuid("teamId deve ser um UUID válido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date deve estar no formato YYYY-MM-DD"),
  supabaseId: z.string().uuid("supabaseId deve ser um UUID válido").nullish(),
});

export async function GET(request: NextRequest) {
  await connection();

  try {
    const url = new URL(request.url);
    const validation = QuerySchema.safeParse({
      teamId: url.searchParams.get("teamId"),
      date: url.searchParams.get("date"),
      supabaseId: url.searchParams.get("supabaseId"),
    });

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const { teamId, date, supabaseId } = validation.data;
    const output = await publicLeadFormUseCase.getPreScheduleSlots(teamId, date, supabaseId ?? undefined);

    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 });
    }

    console.info(`${routePrefix} Slots de pré-agendamento carregados`, { teamId, date });
    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix} Erro:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro interno do servidor"], null),
      { status: 500 }
    );
  }
}
