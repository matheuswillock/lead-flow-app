import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { backofficeBotContextUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotContextUseCase";
import { verifyStudioBotSignature } from "@/lib/studio-bot/hmac";
import { resolveStudioBotWebhookSecretAsync } from "@/lib/studio-bot/resolve-host-secrets";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    const secret = await resolveStudioBotWebhookSecretAsync();
    if (!secret) {
      return NextResponse.json(
        new Output(false, [], ["Webhook secret não configurado"], null),
        { status: 500 }
      );
    }

    const signature = request.headers.get("x-studio-bot-signature");
    if (!verifyStudioBotSignature("", signature, secret)) {
      return NextResponse.json(new Output(false, [], ["Assinatura inválida"], null), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userLinkId = searchParams.get("userLinkId");
    if (!userLinkId) {
      return NextResponse.json(new Output(false, [], ["userLinkId é obrigatório"], null), {
        status: 400,
      });
    }

    const teamId = searchParams.get("teamId");
    const output = await backofficeBotContextUseCase.getContext({
      userLinkId,
      teamId,
    });
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotContextRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
