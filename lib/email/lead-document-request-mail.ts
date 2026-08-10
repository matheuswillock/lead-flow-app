import { render } from "@react-email/render";
import { LeadDocumentRequestEmail } from "@/emails/LeadDocumentRequestEmail";
import { LeadDocumentUploadedEmail } from "@/emails/LeadDocumentUploadedEmail";
import { getEmailService } from "@/lib/services/EmailService";

const FROM = "Corretor Studio <no-reply@corretorstudio.com>";

export type LeadDocumentRequestEmailInput = {
  teamId: string;
  requestId: string;
  closerName: string;
  leadName: string;
  publicUrl: string;
  documents: string[];
  message?: string;
};

export type LeadDocumentUploadedEmailInput = {
  teamId: string;
  documentId: string;
  closerName: string;
  leadName: string;
  documentName: string;
  leadCode: string;
  supabaseId: string;
  appUrl: string;
};

export async function sendLeadDocumentRequestEmail(
  to: string,
  data: LeadDocumentRequestEmailInput
): Promise<void> {
  const html = await render(
    LeadDocumentRequestEmail({
      closerName: data.closerName,
      leadName: data.leadName,
      publicUrl: data.publicUrl,
      documents: data.documents,
      message: data.message,
    })
  );

  const result = await getEmailService().sendEmail({
    from: FROM,
    to: [to],
    subject: `[Corretor Studio] ${data.closerName} solicitou seus documentos`,
    html,
    tracking: {
      teamId: data.teamId,
      category: "transactional",
      sourceType: "lead-document-request",
      sourceId: data.requestId,
      recipientName: data.leadName,
    },
  });

  if (!result.success) {
    throw new Error(`Falha ao enviar e-mail: ${result.error ?? "Erro desconhecido"}`);
  }
}

export async function sendLeadDocumentUploadedEmail(
  to: string,
  data: LeadDocumentUploadedEmailInput
): Promise<void> {
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

  const result = await getEmailService().sendEmail({
    from: FROM,
    to: [to],
    subject: `[Corretor Studio] ${data.leadName} enviou um documento`,
    html,
    tracking: {
      teamId: data.teamId,
      category: "transactional",
      sourceType: "lead-document-uploaded",
      sourceId: data.documentId,
      recipientName: data.closerName,
    },
  });

  if (!result.success) {
    throw new Error(`Falha ao enviar e-mail: ${result.error ?? "Erro desconhecido"}`);
  }
}
