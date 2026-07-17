import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { backofficeBotInboundWebhookUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotInboundWebhookUseCase";
import { verifyStudioBotRequest } from "@/app/api/v1/bot/utils/verifyStudioBotRequest";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

const schema = z.object({
  normalizedPhone: z.string().min(8),
  channelMessageId: z.string().optional(),
  payload: z.object({
    messageType: z.enum(["text", "image", "document", "audio", "video", "sticker", "location"]),
    contentText: z.string().nullable().optional(),
    mediaUrl: z.string().nullable().optional(),
    mediaKey: z.record(z.string(), z.unknown()).nullable().optional(),
    caption: z.string().nullable().optional(),
    mediaFileName: z.string().nullable().optional(),
    linkPreview: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().optional(),
        url: z.string().optional(),
      })
      .nullable()
      .optional(),
    pushName: z.string().nullable().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const verified = await verifyStudioBotRequest(request);
    if (!verified.ok) {
      return NextResponse.json(verified.error, { status: verified.status });
    }

    const parsed = schema.safeParse(JSON.parse(verified.body));
    if (!parsed.success) {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 });
    }

    const idempotencyKey = request.headers.get("x-idempotency-key");
    const output = await backofficeBotInboundWebhookUseCase.handleInbound(
      parsed.data,
      idempotencyKey
    );
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[StudioBotInboundWebhookRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
