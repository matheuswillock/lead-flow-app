import {
  sendLeadDocumentRequestEmail,
  sendLeadDocumentUploadedEmail,
} from "@/lib/email/lead-document-request-mail";
import type {
  ILeadDocumentRequestService,
  SendRequestEmailData,
  SendUploadNotificationEmailData,
} from "./ILeadDocumentRequestService";

export class LeadDocumentRequestService implements ILeadDocumentRequestService {
  async sendRequestEmail(to: string, data: SendRequestEmailData): Promise<void> {
    try {
      await sendLeadDocumentRequestEmail(to, data);
    } catch (error) {
      console.error("[LeadDocumentRequestService] Erro ao enviar e-mail de solicitação:", error);
      throw error instanceof Error ? error : new Error("Falha ao enviar e-mail");
    }
  }

  async sendUploadNotificationEmail(
    to: string,
    data: SendUploadNotificationEmailData
  ): Promise<void> {
    try {
      await sendLeadDocumentUploadedEmail(to, data);
    } catch (error) {
      console.error(
        "[LeadDocumentRequestService] Erro ao enviar e-mail de upload:",
        error
      );
      throw error instanceof Error ? error : new Error("Falha ao enviar e-mail");
    }
  }
}

export const leadDocumentRequestService = new LeadDocumentRequestService();
