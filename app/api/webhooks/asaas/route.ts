// app/api/webhooks/asaas/route.ts

import * as Sentry from "@sentry/nextjs";
import { after, NextRequest, NextResponse } from "next/server";
import {
  asaasWebhookEventRepository,
} from "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import { getClientIpFromRequest } from "@/lib/http/get-client-ip";
import { publishAsaasWebhookEvent } from "@/lib/queues/asaas-webhook-events";
import { publishWithRetry } from "@/lib/queues/publish-with-retry";
import { BILLING_RATE_LIMIT_DEFAULTS, consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit";
import { resolveAsaasWebhookAccount } from "./resolveAsaasWebhookAccount";
import {
  resolveAsaasWebhookEventId,
  type AsaasWebhookBody,
} from "./processAsaasWebhookEvent";

export const maxDuration = 60;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido ao processar webhook";
}

/**
 * S2/DA3: só tentativa com token inválido consome o limiter (por IP).
 * Token válido nunca chama esta função — passa sempre, mesmo com o
 * orçamento de tentativas inválidas estourado para o mesmo IP (anti-C36:
 * uma rajada de eventos legítimos do Asaas não pode virar 429).
 */
async function rejectIfInvalidTokenRateLimited(request: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIpFromRequest(request);
  const result = await consumeBillingRateLimit(
    `webhook-invalid-token:${ip}`,
    BILLING_RATE_LIMIT_DEFAULTS.webhookInvalidToken
  );
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too Many Requests" },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const asaasToken = request.headers.get("asaas-access-token");
    const receivedToken = asaasToken?.trim();

    if (!receivedToken) {
      const limited = await rejectIfInvalidTokenRateLimited(request);
      if (limited) return limited;

      console.error("[AsaasWebhookRoute][POST] Token não fornecido");
      // E7 (C36): observabilidade mínima do 401 em série — sintoma
      // precursor da fila pausada pelo Asaas (15 falhas consecutivas).
      Sentry.captureMessage("[AsaasWebhookRoute] Token não fornecido", {
        tags: { route: "AsaasWebhookRoute", phase: "auth-rejected" },
      });
      return NextResponse.json(
        { error: "Unauthorized: Token não fornecido" },
        { status: 401 }
      );
    }

    // M3.1 (E4): resolve qual conta (primary/legacy) enviou o evento
    // comparando contra os dois tokens, cada um via timingSafeEqual (E3).
    const account = resolveAsaasWebhookAccount(receivedToken);

    if (!account) {
      const limited = await rejectIfInvalidTokenRateLimited(request);
      if (limited) return limited;

      console.error("[AsaasWebhookRoute][POST] Token inválido");
      // E7 (C36): idem — ver comentário acima.
      Sentry.captureMessage("[AsaasWebhookRoute] Token inválido", {
        tags: { route: "AsaasWebhookRoute", phase: "auth-rejected" },
      });
      return NextResponse.json(
        { error: "Unauthorized: Token inválido" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AsaasWebhookBody;
    const eventId = resolveAsaasWebhookEventId(body);

    console.info("[AsaasWebhookRoute][POST] recebido", {
      eventId,
      account,
      event: body.event,
      paymentId: body.payment?.id ?? null,
      paymentStatus: body.payment?.status ?? null,
    });

    if (body.payment && !body.payment.id) {
      console.warn("[AsaasWebhookRoute][POST] Payment sem ID - ignorando");
      return NextResponse.json(
        { success: true, message: "Payment sem ID - ignorado" },
        { status: 200 }
      );
    }

    const claim = await asaasWebhookEventRepository.claimForProcessing({
      id: eventId,
      eventType: body.event ?? null,
      payload: body as object,
      account,
    });

    if (claim === "already_processed" || claim === "already_processing") {
      console.info("[AsaasWebhookRoute][POST] evento já tratado", { eventId, claim });
      return NextResponse.json(
        { success: true, message: "Webhook já recebido", eventId, claim },
        { status: 200 }
      );
    }

    after(async () => {
      try {
        const publishResult = await publishWithRetry(() =>
          publishAsaasWebhookEvent({ eventId, body, account })
        );
        if (!publishResult.ok) {
          const message = getErrorMessage(publishResult.error);
          console.error("[AsaasWebhookRoute][after][publish-exhausted]", {
            eventId,
            attempts: publishResult.attempts,
            error: message,
          });
          Sentry.captureException(publishResult.error, {
            tags: { route: "AsaasWebhookRoute", phase: "after-publish-exhausted" },
            extra: { eventId, event: body.event, paymentId: body.payment?.id, attempts: publishResult.attempts },
          });
          await asaasWebhookEventRepository.markFailed(eventId, message, "queue_publish_failed").catch((markError) => {
            console.error("[AsaasWebhookRoute][after] falha ao marcar evento como failed", { eventId, markError });
          });
        }
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        console.error("[AsaasWebhookRoute][after] erro inesperado ao publicar", { eventId, error });
        Sentry.captureException(error, {
          tags: { route: "AsaasWebhookRoute", phase: "after" },
          extra: { eventId, event: body.event, paymentId: body.payment?.id },
        });
      }
    });

    return NextResponse.json(
      { success: true, message: "Webhook recebido", eventId },
      { status: 200 }
    );
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[AsaasWebhookRoute][POST] erro inesperado no ack", error);
    Sentry.captureException(error, {
      tags: { route: "AsaasWebhookRoute", phase: "ack" },
    });

    return NextResponse.json(
      { success: false, message: "Erro ao receber webhook" },
      { status: 200 }
    );
  }
}
