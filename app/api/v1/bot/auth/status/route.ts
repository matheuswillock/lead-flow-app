import { NextResponse, type NextRequest } from "next/server";
import { Output } from "@/lib/output";
import { backofficeBotAuthUseCase } from "@/app/api/useCases/backofficeBot/BackofficeBotAuthUseCase";
import { verifyStudioBotSignature } from "@/lib/studio-bot/hmac";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted";

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.BACKOFFICE_STUDIO_BOT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        new Output(false, [], ["Webhook secret não configurado"], null),
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const signature = request.headers.get("x-studio-bot-signature");
    if (!verifyStudioBotSignature("", signature, secret)) {
      return NextResponse.json(new Output(false, [], ["Assinatura inválida"], null), { status: 403 });
    }

    const phone = searchParams.get("phone");
    if (!phone) {
      return NextResponse.json(new Output(false, [], ["phone é obrigatório"], null), { status: 400 });
    }

    const output = await backofficeBotAuthUseCase.getAuthStatus(phone);
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[BotAuthStatusRoute][GET]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 });
  }
}
