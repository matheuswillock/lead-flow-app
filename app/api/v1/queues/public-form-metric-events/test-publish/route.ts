import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import {
  publishPublicFormMetricEvent,
  type PublicFormMetricQueuePayload,
} from "@/lib/queues/public-form-metric-events";

/**
 * Producer de prova mínima (T1) — não altera a rota pública real de formulários.
 * Auth: Authorization Bearer CRON_SECRET.
 * Bloqueado em production para evitar ruído/custo acidental.
 */
async function handle(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), {
      status: 401,
    });
  }

  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json(
      new Output(
        false,
        [],
        ["Publicação de teste bloqueada em production"],
        null,
      ),
      { status: 403 },
    );
  }

  let body: Partial<PublicFormMetricQueuePayload> = {};
  try {
    body = (await request.json()) as Partial<PublicFormMetricQueuePayload>;
  } catch {
    body = {};
  }

  const receivedAt = new Date().toISOString();
  const payload: PublicFormMetricQueuePayload = {
    publicId: body.publicId?.trim() || "t1-validation-public-id",
    eventKey:
      body.eventKey?.trim() ||
      `t1-validation-${receivedAt}-${crypto.randomUUID()}`,
    eventType: body.eventType || "form_viewed",
    questionId: body.questionId ?? null,
    visitorSessionId:
      body.visitorSessionId?.trim() || `t1-session-${crypto.randomUUID()}`,
    origin: body.origin && typeof body.origin === "object" ? body.origin : { source: "t1-poc" },
    receivedAt: body.receivedAt || receivedAt,
  };

  try {
    const { messageId } = await publishPublicFormMetricEvent(payload);
    console.info("[PublicFormMetricEventsTestPublish][POST] queued", {
      messageId,
      eventKey: payload.eventKey,
      eventType: payload.eventType,
    });
    return NextResponse.json(
      new Output(true, ["Mensagem publicada na Vercel Queue"], [], {
        messageId,
        topic: "public-form-metric-events",
        payload,
      }),
      { status: 202 },
    );
  } catch (error) {
    console.error("[PublicFormMetricEventsTestPublish][POST] publish failed", error);
    return NextResponse.json(
      new Output(
        false,
        [],
        [
          error instanceof Error
            ? error.message
            : "Falha ao publicar na Vercel Queue",
        ],
        null,
      ),
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  await connection();
  return handle(request);
}
