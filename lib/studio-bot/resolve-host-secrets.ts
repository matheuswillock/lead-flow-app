import { prisma } from "@/app/api/infra/data/prisma";
import { decryptHostEnvMap } from "@/lib/studio-bot/host-cipher";
import { resolveStudioBotWebhookSecret as resolveEnvWebhookSecret } from "@/lib/studio-bot/hmac";

/**
 * Prefere o secret persistido no canal (rotacionável pelo painel Ops).
 * Fallback: env Vercel/bootstrap.
 */
export async function resolveStudioBotWebhookSecretAsync(): Promise<string | null> {
  const channel = await prisma.backofficeBotChannel.findFirst({
    orderBy: { createdAt: "asc" },
    select: { webhookSecret: true, n8nOutboundSecret: true },
  });

  const fromChannel =
    channel?.webhookSecret?.trim() || channel?.n8nOutboundSecret?.trim() || null;
  if (fromChannel) return fromChannel;

  return resolveEnvWebhookSecret();
}

export async function resolveEvoApiConfig(): Promise<{
  baseUrl: string;
  apiKey: string;
}> {
  const settings = await prisma.backofficeBotHostSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { evolutionEnvEncrypted: true, n8nEnvEncrypted: true },
  });

  const evolutionEnv = decryptHostEnvMap(settings?.evolutionEnvEncrypted);
  const n8nEnv = decryptHostEnvMap(settings?.n8nEnvEncrypted);

  const baseUrl =
    n8nEnv.EVO_API_BASE_URL?.trim() ||
    process.env.EVO_API_BASE_URL?.trim() ||
    "";
  const apiKey =
    evolutionEnv.AUTHENTICATION_API_KEY?.trim() ||
    n8nEnv.EVO_API_KEY?.trim() ||
    process.env.EVO_API_KEY?.trim() ||
    "";

  if (!baseUrl) {
    throw new Error("[resolveEvoApiConfig] EVO_API_BASE_URL não configurado");
  }
  if (!apiKey) {
    throw new Error("[resolveEvoApiConfig] EVO_API_KEY não configurado");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}
