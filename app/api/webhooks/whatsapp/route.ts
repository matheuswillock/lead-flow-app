import { NextRequest, NextResponse } from "next/server";
import { whatsAppCloudService } from "@/app/api/services/whatsapp/WhatsAppCloudService";
import { whatsAppBotUseCase } from "@/app/api/useCases/whatsapp/WhatsAppBotUseCase";
import { whatsAppIntegrationRepository } from "@/app/api/infra/data/repositories/integrations/WhatsAppIntegrationRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.info("🔍 Verificação do webhook WhatsApp recebida:", {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge
    });

    if (mode === "subscribe" && token) {
      const integration = await whatsAppIntegrationRepository.findByVerifyToken(token);
      if (integration) {
        console.info("✅ Webhook WhatsApp verificado com sucesso");
        return new NextResponse(challenge, { status: 200 });
      }
    }

    console.error("❌ Token de verificação inválido (WhatsApp)");
    return NextResponse.json({ error: "Token de verificação inválido" }, { status: 403 });
  } catch (error) {
    console.error("❌ Erro na verificação do webhook WhatsApp:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-hub-signature-256") || "";
    const body = await request.text();

    const isValid = whatsAppCloudService.validateWebhookSignature(signature, body);
    if (!isValid) {
      console.error("❌ Assinatura do webhook WhatsApp inválida");
      return NextResponse.json({ error: "Assinatura inválida" }, { status: 403 });
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      console.error("❌ Payload inválido no webhook WhatsApp:", error);
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
    }

    const result = await whatsAppBotUseCase.processWebhook(payload);

    return NextResponse.json(
      {
        success: true,
        message: result.successMessages?.[0] || "Webhook processado",
        errors: result.errorMessages,
        data: result.result
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Erro inesperado no webhook WhatsApp:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno ao processar webhook" },
      { status: 200 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
