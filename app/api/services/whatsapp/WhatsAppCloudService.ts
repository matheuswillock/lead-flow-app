import crypto from "crypto";

export class WhatsAppCloudService {
  private readonly graphApiUrl = "https://graph.facebook.com/v21.0";
  private readonly appSecret: string;

  constructor() {
    this.appSecret = process.env.META_APP_SECRET || "";

    if (!this.appSecret) {
      console.warn("⚠️  META_APP_SECRET não configurado");
    }
  }

  validateWebhookSignature(signature: string, body: string): boolean {
    if (!this.appSecret) {
      console.error("🔐 META_APP_SECRET não configurado - não é possível validar assinatura");
      return false;
    }

    if (!signature) {
      console.error("🔐 Assinatura ausente no header X-Hub-Signature-256");
      return false;
    }

    const signatureHash = signature.replace("sha256=", "");

    const expectedHash = crypto
      .createHmac("sha256", this.appSecret)
      .update(body)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, "hex"),
        Buffer.from(expectedHash, "hex")
      );
    } catch (error) {
      console.error("❌ Erro ao validar assinatura:", error);
      return false;
    }
  }

  async sendTextMessage(params: {
    phoneNumberId: string;
    accessToken: string;
    to: string;
    message: string;
  }): Promise<any> {
    const url = `${this.graphApiUrl}/${params.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "text",
        text: {
          body: params.message
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<any> {
    const url = `${this.graphApiUrl}/${phoneNumberId}?fields=display_phone_number,verified_name`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }
}

export const whatsAppCloudService = new WhatsAppCloudService();
