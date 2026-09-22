import { NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { studioWebhookErrors } from "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase";

/**
 * SPEC 10, DA4/A-E4 (T-10.13): o modo "Sem token" saiu — esta rota (sem
 * token no path) responde 401 para qualquer corpo, sempre. 0 webhooks em
 * modo "Sem token" medidos em produção (auditoria §10.2, 21/09), então
 * nenhum time ativo dependia dela.
 */
export async function POST() {
  return NextResponse.json(new Output(false, [], [studioWebhookErrors.UNAUTHORIZED_ERROR], null), {
    status: 401,
  });
}
