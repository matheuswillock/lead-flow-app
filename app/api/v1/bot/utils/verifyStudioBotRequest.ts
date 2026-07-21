import type { NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { verifyStudioBotSignature } from "@/lib/studio-bot/hmac";
import { resolveStudioBotWebhookSecretAsync } from "@/lib/studio-bot/resolve-host-secrets";

export type StudioBotHmacResult =
  | { ok: true; body: string; error?: never; status?: never }
  | { ok?: never; error: Output; status: number };

export async function verifyStudioBotRequest(request: NextRequest): Promise<StudioBotHmacResult> {
  const secret = await resolveStudioBotWebhookSecretAsync();
  if (!secret) {
    return {
      error: new Output(false, [], ["Webhook secret não configurado"], null),
      status: 500,
    };
  }

  const body = await request.text();
  const signature = request.headers.get("x-studio-bot-signature");
  const isValid = verifyStudioBotSignature(body, signature, secret);

  if (!isValid) {
    return {
      error: new Output(false, [], ["Assinatura inválida"], null),
      status: 403,
    };
  }

  return { ok: true, body };
}
