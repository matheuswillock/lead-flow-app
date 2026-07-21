import type { ISupportRequestService, SupportRequestData } from "./ISupportRequestService";
import { STORAGE_BUCKETS, SupabaseStorageService } from "@/lib/supabase/storage";

const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

// Slack section blocks aceitam ate 3000 caracteres em `text.text`:
// https://docs.slack.dev/reference/block-kit/blocks/section-block
// Usamos uma margem para o rotulo "*Mensagem (n/n):*\n" adicionado a cada pedaco.
const MESSAGE_CHUNK_SIZE = 2900;

function escapeSlackMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [""];
}

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

      // Escapado para evitar que texto do solicitante (ex.: "<!channel>") seja
      // interpretado como sintaxe de controle do mrkdwn do Slack.
      const safeSubject = escapeSlackMrkdwn(data.subject.trim());
      const safeMessage = escapeSlackMrkdwn(data.message.trim());
      const safeName = escapeSlackMrkdwn(data.requesterName.trim() || "Usuário");
      const safeEmail = escapeSlackMrkdwn(data.requesterEmail.trim() || "E-mail não informado");
      const supportId = data.supportId;

      const uploadResult = await this.uploadAttachments(data.attachments || [], supportId);
      if (uploadResult.error) {
        return { success: false, error: uploadResult.error };
      }

      const payload = this.buildSlackPayload({
        supportId,
        subject: safeSubject,
        requesterName: safeName,
        requesterEmail: safeEmail,
        message: safeMessage,
        attachmentUrls: uploadResult.urls,
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
  ): Promise<{ urls: string[]; error?: string }> {
    if (!attachments || attachments.length === 0) {
      return { urls: [] };
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
        return { urls: [], error: uploadResult.error || "Falha ao enviar imagem anexada" };
      }

      const signedUrlResult = await SupabaseStorageService.createSignedUrl(
        uploadResult.fileId,
        STORAGE_BUCKETS.SUPPORT_REQUEST_ATTACHMENTS,
        ATTACHMENT_SIGNED_URL_TTL_SECONDS,
      );

      if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
        console.error("[SupportRequestService][uploadAttachments] Falha ao gerar URL assinada:", {
          supportId,
          fileName: attachment.fileName,
          error: signedUrlResult.error,
        });
        return { urls: [], error: signedUrlResult.error || "Falha ao gerar link da imagem anexada" };
      }

      urls.push(signedUrlResult.signedUrl);
    }

    return { urls };
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
      ...this.buildMessageBlocks(message),
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

  private buildMessageBlocks(message: string): Record<string, unknown>[] {
    const chunks = chunkText(message, MESSAGE_CHUNK_SIZE);

    return chunks.map((chunk, index) => {
      const label = chunks.length > 1 ? `*Mensagem (${index + 1}/${chunks.length}):*\n` : "*Mensagem:*\n";
      return {
        type: "section",
        text: { type: "mrkdwn", text: `${label}${chunk}` },
      };
    });
  }
}

export const supportRequestService = new SupportRequestService();
