import type { Attachment } from "resend";
import { z } from "zod";
import { Output } from "@/lib/output";
import type {
  CreateSupportRequestInput,
  ISupportRequestUseCase,
  SupportRequestAttachmentInput,
} from "./ISupportRequestUseCase";
import { supportRequestService } from "@/app/api/services/support/SupportRequestService";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

const supportRequestSchema = z.object({
  subject: z.string().trim().min(1, "Assunto e obrigatorio"),
  message: z.string().trim().min(1, "Mensagem e obrigatoria"),
  requesterName: z.string().optional(),
  requesterEmail: z.string().trim().email("Email do solicitante invalido"),
});

function generateSupportId(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `SUP-${code}`;
}

export class SupportRequestUseCase implements ISupportRequestUseCase {
  async createSupportRequest(input: CreateSupportRequestInput): Promise<Output> {
    try {
      const parsedInput = supportRequestSchema.safeParse(input);
      if (!parsedInput.success) {
        return new Output(
          false,
          [],
          parsedInput.error.issues.map((issue) => issue.message),
          null,
        );
      }

      const validatedInput = parsedInput.data;
      const supportId = generateSupportId();

      const attachments = this.parseAttachments(input.attachments || []);
      if (attachments.error) {
        return new Output(false, [], [attachments.error], null);
      }

      const sendResult = await supportRequestService.sendSupportRequest({
        supportId,
        subject: validatedInput.subject,
        message: validatedInput.message,
        requesterName: validatedInput.requesterName || "Usuario",
        requesterEmail: validatedInput.requesterEmail,
        attachments: attachments.data,
      });

      if (!sendResult.success) {
        return new Output(false, [], [sendResult.error || "Falha ao enviar pedido de suporte"], null);
      }

      return new Output(true, ["Pedido de suporte enviado com sucesso"], [], {
        supportId,
      });
    } catch (error) {
      console.error("[SupportRequestUseCase][createSupportRequest] Erro interno:", error);
      return new Output(false, [], ["Erro interno ao enviar pedido de suporte"], null);
    }
  }

  private parseAttachments(
    rawAttachments: SupportRequestAttachmentInput[],
  ): { data?: Attachment[]; error?: string } {
    if (rawAttachments.length > MAX_ATTACHMENTS) {
      return { error: `Limite de ${MAX_ATTACHMENTS} imagens por envio` };
    }

    const parsed: Attachment[] = [];

    for (const attachment of rawAttachments) {
      if (!attachment.fileName || !attachment.contentBase64 || !attachment.contentType) {
        return { error: "Arquivo invalido enviado" };
      }

      if (!attachment.contentType.startsWith("image/")) {
        return { error: "Apenas imagens sao permitidas" };
      }

      if (attachment.size <= 0 || attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
        return { error: "Cada imagem deve ter ate 5MB" };
      }

      parsed.push({
        filename: attachment.fileName,
        content: attachment.contentBase64,
        contentType: attachment.contentType,
      });
    }

    return { data: parsed };
  }
}

export const supportRequestUseCase = new SupportRequestUseCase();
