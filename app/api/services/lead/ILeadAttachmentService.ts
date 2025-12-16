import { LeadAttachmentUploadResult } from "./DTOs/LeadAttachmentUploadResult";
import { DeleteLeadAttachmentResult } from "./DTOs/DeleteLeadAttachmentResult";

export interface ILeadAttachmentService {
  uploadAttachment(file: File, leadId: string, fileName: string): Promise<LeadAttachmentUploadResult>;
  deleteAttachment(attachmentId: string): Promise<DeleteLeadAttachmentResult>;
  getAttachmentUrl(attachmentId: string): Promise<string | null>;
  listLeadAttachments(leadId: string): Promise<string[]>;
}
