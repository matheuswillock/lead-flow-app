import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";

const routePrefix = "[IntegrationBootstrapRoute][GET]";

const QuerySchema = z.object({
  supabaseId: z.string().uuid("supabaseId deve ser um UUID válido"),
  teamId: z.string().uuid("teamId deve ser um UUID válido"),
});

const resolveFailureStatus = (messages: string[]) => {
  const normalizedErrors = messages.join(" ").toLowerCase();
  if (
    normalizedErrors.includes("não encontrado") ||
    normalizedErrors.includes("nao encontrado") ||
    normalizedErrors.includes("não pertence") ||
    normalizedErrors.includes("nao pertence")
  ) {
    return 404;
  }

  return 400;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const validation = QuerySchema.safeParse({
      supabaseId: url.searchParams.get("supabaseId"),
      teamId: url.searchParams.get("teamId"),
    });

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const { supabaseId, teamId } = validation.data;
    const output = await publicLeadFormUseCase.getPublicFormBootstrap(supabaseId, teamId);

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveFailureStatus(output.errorMessages) });
    }

    const result = output.result as
      | {
          healthPlans?: unknown[];
          closers?: unknown[];
        }
      | null;

    console.info(`${routePrefix} Bootstrap carregado com sucesso`, {
      supabaseId,
      teamId,
      healthPlansCount: result?.healthPlans?.length ?? 0,
      closersCount: result?.closers?.length ?? 0,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    console.error(`${routePrefix} Erro ao carregar bootstrap do formulário público:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao carregar dados iniciais do formulário"], null),
      { status: 500 }
    );
  }
}
