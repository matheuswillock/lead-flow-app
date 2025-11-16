import { Output } from "@/lib/output";

export interface ILeadAttachmentUseCase {
  uploadAttachment(leadId: string, file: File, uploadedBy: string): Promise<Output>;
  deleteAttachment(attachmentId: string, leadId: string): Promise<Output>;
  listAttachments(leadId: string): Promise<Output>;
}
