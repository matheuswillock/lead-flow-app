// app/api/webhooks/asaas/route.ts

import * as Sentry from "@sentry/nextjs";
import { after, NextRequest, NextResponse } from "next/server";
import {
  asaasWebhookEventRepository,
} from "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";
import {
  processAsaasWebhookEvent,
  resolveAsaasWebhookEventId,
  type AsaasWebhookBody,
} from "./processAsaasWebhookEvent";

export const maxDuration = 60;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido ao processar webhook";
}

export async function POST(request: NextRequest) {
  try {
    const asaasToken = request.headers.get("asaas-access-token");
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    const receivedToken = asaasToken?.trim();

    if (!receivedToken) {
      console.error("[AsaasWebhookRoute][POST] Token não fornecido");
      return NextResponse.json(
        { error: "Unauthorized: Token não fornecido" },
        { status: 401 }
      );
    }

    if (receivedToken !== expectedToken) {
      console.error("[AsaasWebhookRoute][POST] Token inválido");
      return NextResponse.json(
        { error: "Unauthorized: Token inválido" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AsaasWebhookBody;
    const eventId = resolveAsaasWebhookEventId(body);

    console.info("[AsaasWebhookRoute][POST] recebido", {
      eventId,
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
        await processAsaasWebhookEvent(body);
        await asaasWebhookEventRepository.markProcessed(eventId);
      } catch (error) {
        rethrowIfPrerenderInterrupted(error);
        const message = getErrorMessage(error);
        console.error("[AsaasWebhookRoute][after] falha no processamento", {
          eventId,
          error: message,
        });
        Sentry.captureException(error, {
          tags: { route: "AsaasWebhookRoute", phase: "after" },
          extra: { eventId, event: body.event, paymentId: body.payment?.id },
        });
        await asaasWebhookEventRepository.markFailed(eventId, message).catch((markError) => {
          console.error("[AsaasWebhookRoute][after] falha ao marcar evento como failed", {
            eventId,
            markError,
          });
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
