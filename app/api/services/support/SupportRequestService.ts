import type { ISupportRequestService, SupportRequestData } from "./ISupportRequestService";
import { getEmailService } from "@/lib/services/EmailService";

export class SupportRequestService implements ISupportRequestService {
  async sendSupportRequest(data: SupportRequestData): Promise<{ success: boolean; error?: string }> {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL;

      if (!supportEmail) {
        return { success: false, error: "SUPPORT_EMAIL não configurado nas variáveis de ambiente" };
      }

      const safeSubject = data.subject.trim();
      const safeMessage = data.message.trim();
      const safeName = data.requesterName.trim() || "Usuário";
      const safeEmail = data.requesterEmail.trim() || "E-mail não informado";
      const supportId = data.supportId;

      const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="margin:0;padding:0;background:#f5f5f5;font-family:Segoe UI,Arial,sans-serif;">
            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td align="center" style="padding:24px;">
                  <table role="presentation" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                    <tr>
                      <td style="background:#111827;padding:20px 24px;">
                        <h1 style="margin:0;color:#ffffff;font-size:20px;">Novo pedido de suporte</h1>
                        <p style="margin:8px 0 0 0;color:#d1d5db;font-size:13px;">ID: ${supportId}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:24px;">
                        <p style="margin:0 0 16px 0;color:#111827;font-size:14px;"><strong>Assunto:</strong> ${safeSubject}</p>
                        <p style="margin:0 0 8px 0;color:#111827;font-size:14px;"><strong>Solicitante:</strong> ${safeName}</p>
                        <p style="margin:0 0 8px 0;color:#111827;font-size:14px;"><strong>Email:</strong> ${safeEmail}</p>
                        <div style="margin-top:16px;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                          <p style="margin:0 0 8px 0;color:#111827;font-size:14px;"><strong>Mensagem:</strong></p>
                          <p style="margin:0;white-space:pre-wrap;color:#374151;font-size:14px;line-height:1.5;">${safeMessage}</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;

      const text = [
        "Novo pedido de suporte",
        `ID: ${supportId}`,
        `Assunto: ${safeSubject}`,
        `Solicitante: ${safeName}`,
        `Email: ${safeEmail}`,
        "",
        "Mensagem:",
        safeMessage,
      ].join("\n");

      const emailService = getEmailService();
      const result = await emailService.sendEmail({
        to: [supportEmail],
        subject: `[SUPORTE][${supportId}] ${safeSubject}`,
        html,
        text,
        attachments: data.attachments,
      });

      if (!result.success) {
        return { success: false, error: result.error || "Falha ao enviar pedido de suporte" };
      }

      return { success: true };
    } catch (error) {
      console.error("[SupportRequestService][sendSupportRequest] Erro ao enviar pedido de suporte:", error);
      return { success: false, error: "Erro interno ao enviar pedido de suporte" };
    }
  }
}

export const supportRequestService = new SupportRequestService();
