import type { ISupportRequestService, SupportRequestData } from "./ISupportRequestService";
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage";

const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export class SupportRequestService implements ISupportRequestService {
  async sendSupportRequest(data: SupportRequestData): Promise<{ success: boolean; error?: string }> {
    try {
      const slackWebhookUrl = process.env.SLACK_SUPPORT_WEBHOOK_URL;

      if (!slackWebhookUrl) {
        return {
          success: false,
          error: "SLACK_SUPPORT_WEBHOOK_URL não configurado nas variáveis de ambiente",
        };
      }

      const safeSubject = data.subject.trim();
      const safeMessage = data.message.trim();
      const safeName = data.requesterName.trim() || "Usuário";
      const safeEmail = data.requesterEmail.trim() || "E-mail não informado";
      const supportId = data.supportId;

      const attachmentUrls = await this.uploadAttachments(data.attachments || [], supportId);

      const payload = this.buildSlackPayload({
        supportId,
        subject: safeSubject,
        requesterName: safeName,
        requesterEmail: safeEmail,
        message: safeMessage,
        attachmentUrls,
      });

      const response = await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        console.error("[SupportRequestService][sendSupportRequest] Slack webhook retornou erro:", {
          status: response.status,
          responseBody,
        });
        return { success: false, error: "Falha ao enviar pedido de suporte" };
      }

      return { success: true };
    } catch (error) {
      console.error("[SupportRequestService][sendSupportRequest] Erro ao enviar pedido de suporte:", error);
      return { success: false, error: "Erro interno ao enviar pedido de suporte" };
    }
  }

  private async uploadAttachments(
    attachments: SupportRequestData["attachments"],
    supportId: string,
  ): Promise<string[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    const urls: string[] = [];

    for (const attachment of attachments) {
      const buffer = Buffer.from(attachment.contentBase64, "base64");
      const file = new File([buffer], attachment.fileName, { type: attachment.contentType });

      const uploadResult = await SupabaseStorageService.uploadFile(
        file,
        STORAGE_BUCKETS.SUPPORT_REQUEST_ATTACHMENTS,
        supportId,
        attachment.fileName,
      );

      if (!uploadResult.success || !uploadResult.fileId) {
        console.error("[SupportRequestService][uploadAttachments] Falha ao subir anexo:", {
          supportId,
          fileName: attachment.fileName,
          error: uploadResult.error,
        });
        continue;
      }

      const signedUrlResult = await SupabaseStorageService.createSignedUrl(
        uploadResult.fileId,
        STORAGE_BUCKETS.SUPPORT_REQUEST_ATTACHMENTS,
        ATTACHMENT_SIGNED_URL_TTL_SECONDS,
      );

      if (signedUrlResult.success && signedUrlResult.signedUrl) {
        urls.push(signedUrlResult.signedUrl);
      } else {
        console.error("[SupportRequestService][uploadAttachments] Falha ao gerar URL assinada:", {
          supportId,
          fileName: attachment.fileName,
          error: signedUrlResult.error,
        });
      }
    }

    return urls;
  }

  private buildSlackPayload(params: {
    supportId: string;
    subject: string;
    requesterName: string;
    requesterEmail: string;
    message: string;
    attachmentUrls: string[];
  }) {
    const { supportId, subject, requesterName, requesterEmail, message, attachmentUrls } = params;

    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `Novo pedido de suporte [${supportId}]`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Assunto:*\n${subject}` },
          { type: "mrkdwn", text: `*Solicitante:*\n${requesterName}` },
          { type: "mrkdwn", text: `*Email:*\n${requesterEmail}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Mensagem:*\n${message}` },
      },
    ];

    if (attachmentUrls.length > 0) {
      const imagesText = attachmentUrls
        .map((url, index) => `<${url}|Imagem ${index + 1}>`)
        .join("\n");
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Imagens anexadas:*\n${imagesText}` },
      });
    }

    return {
      text: `Novo pedido de suporte [${supportId}]: ${subject}`,
      blocks,
    };
  }
}

export const supportRequestService = new SupportRequestService();
