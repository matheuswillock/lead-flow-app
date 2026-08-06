import { assertResend } from "@/lib/email";
import { render } from "@react-email/render";
import { LeadDocumentRequestEmail } from "@/emails/LeadDocumentRequestEmail";
import { LeadDocumentUploadedEmail } from "@/emails/LeadDocumentUploadedEmail";
import type {
  ILeadDocumentRequestService,
  SendRequestEmailData,
  SendUploadNotificationEmailData,
} from "./ILeadDocumentRequestService";

const FROM = "Corretor Studio <no-reply@corretorstudio.com>";

export class LeadDocumentRequestService implements ILeadDocumentRequestService {
  async sendRequestEmail(to: string, data: SendRequestEmailData): Promise<void> {
    const resend = assertResend();
    const html = await render(
      LeadDocumentRequestEmail({
        closerName: data.closerName,
        leadName: data.leadName,
        publicUrl: data.publicUrl,
        documents: data.documents,
        message: data.message,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `[Corretor Studio] ${data.closerName} solicitou seus documentos`,
      html,
    });

    if (error) {
      console.error("[LeadDocumentRequestService] Erro ao enviar e-mail de solicitação:", error);
      throw new Error(`Falha ao enviar e-mail: ${error.message}`);
    }
  }

  async sendUploadNotificationEmail(
    to: string,
    data: SendUploadNotificationEmailData
  ): Promise<void> {
    const resend = assertResend();
    const html = await render(
      LeadDocumentUploadedEmail({
        closerName: data.closerName,
        leadName: data.leadName,
        documentName: data.documentName,
        leadCode: data.leadCode,
        supabaseId: data.supabaseId,
        appUrl: data.appUrl,
      })
    );

    const { error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `[Corretor Studio] ${data.leadName} enviou um documento`,
      html,
    });

    if (error) {
      console.error(
        "[LeadDocumentRequestService] Erro ao enviar e-mail de upload:",
        error
      );
      throw new Error(`Falha ao enviar e-mail: ${error.message}`);
    }
  }
}

export const leadDocumentRequestService = new LeadDocumentRequestService();
