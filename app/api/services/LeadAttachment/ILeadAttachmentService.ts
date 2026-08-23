import type { Attachment } from "resend";
import { AttachmentUploadResult } from "./DTOs/AttachmentUploadResult";
import { DeleteAttachmentResult } from "./DTOs/DeleteAttachmentResult";

export interface ILeadAttachmentService {
  uploadAttachment(file: File, leadId: string, uploadedBy: string): Promise<AttachmentUploadResult>;
  deleteAttachment(attachmentId: string): Promise<DeleteAttachmentResult>;
  getAttachmentUrl(fileId: string): Promise<string | null>;
  listLeadAttachments(leadId: string): Promise<string[]>;
  /**
   * Baixa os anexos do lead e devolve no formato de anexo de e-mail.
   * Tenta o storage primeiro e cai para a URL publica; anexo que falhar e
   * omitido, para nao impedir o envio da proposta.
   */
  buildProposalAttachments(leadId: string): Promise<Attachment[]>;
}
