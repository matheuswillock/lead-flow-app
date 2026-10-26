import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { publicLeadFormUseCase } from "@/app/api/useCases/integrations/PublicLeadFormUseCase";
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit";

const routePrefix = "[IntegrationBootstrapRoute][GET]";

const QuerySchema = z.object({
  teamId: z.string().uuid("teamId deve ser um UUID válido"),
  supabaseId: z.string().uuid("supabaseId deve ser um UUID válido").nullish(),
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

async function getCachedPublicFormBootstrap(teamId: string, supabaseId: string | null) {
  "use cache";
  cacheTag(cacheTags.publicFormBootstrap(teamId));
  cacheTag(cacheTags.healthPlans());
  cacheTag(cacheTags.teamMembers(teamId));
  cacheLife({ stale: 60, revalidate: 120, expire: 300 });

  const output = await publicLeadFormUseCase.getPublicFormBootstrap(teamId, supabaseId ?? undefined);
  return {
    isValid: output.isValid,
    successMessages: output.successMessages,
    errorMessages: output.errorMessages,
    result: output.result,
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const validation = QuerySchema.safeParse({
      teamId: url.searchParams.get("teamId"),
      supabaseId: url.searchParams.get("supabaseId"),
    });

    if (!validation.success) {
      const errors = validation.error.issues.map((issue) => issue.message);
      return NextResponse.json(new Output(false, [], errors, null), { status: 400 });
    }

    const { teamId, supabaseId } = validation.data;

    // SPEC 40 A-E1/R40-9 (V3): fora do cache do Next.js (`"use cache"`
    // memoiza por `teamId`, então times diferentes não compartilham cota
    // via cache) — sem isso, dava para varrer `teamId`s em série sem teto.
    const rate = await consumePublicFormRateLimit(
      `lead-form-bootstrap:${teamId}:${publicFormRequestFingerprint(request)}`,
      { limit: 60, windowMs: 60_000 }
    );
    if (!rate.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Recebemos muitos envios agora. Tente de novo em alguns minutos."], null),
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const cachedOutput = await getCachedPublicFormBootstrap(teamId, supabaseId ?? null);
    const output = new Output(
      cachedOutput.isValid,
      cachedOutput.successMessages,
      cachedOutput.errorMessages,
      cachedOutput.result,
    );

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveFailureStatus(output.errorMessages) });
    }

    const result = output.result as
      | {
          healthPlans?: unknown[];
          closers?: unknown[];
          sdrs?: unknown[];
        }
      | null;

    console.info(`${routePrefix} Bootstrap carregado com sucesso`, {
      teamId,
      supabaseId: supabaseId ?? null,
      healthPlansCount: result?.healthPlans?.length ?? 0,
      closersCount: result?.closers?.length ?? 0,
      sdrsCount: result?.sdrs?.length ?? 0,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error(`${routePrefix} Erro ao carregar bootstrap do formulário público:`, error);
    return NextResponse.json(
      new Output(false, [], ["Erro ao carregar dados iniciais do formulário"], null),
      { status: 500 }
    );
  }
}
