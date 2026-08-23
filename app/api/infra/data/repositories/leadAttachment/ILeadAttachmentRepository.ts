import type { LeadAttachment } from "@prisma/client";

/** Dados necessarios para baixar e anexar um arquivo do lead a um e-mail. */
export type LeadAttachmentDownloadRef = Pick<
  LeadAttachment,
  "id" | "fileName" | "fileType" | "storagePath" | "fileUrl"
>;

export interface ILeadAttachmentRepository {
  /** Anexos do lead na ordem de upload, para montar a proposta. */
  findDownloadRefsByLeadId(leadId: string): Promise<LeadAttachmentDownloadRef[]>;
}
