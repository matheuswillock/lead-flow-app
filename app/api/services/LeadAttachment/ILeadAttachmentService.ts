import { AttachmentUploadResult } from "./DTOs/AttachmentUploadResult";
import { DeleteAttachmentResult } from "./DTOs/DeleteAttachmentResult";

export interface ILeadAttachmentService {
  uploadAttachment(file: File, leadId: string, uploadedBy: string): Promise<AttachmentUploadResult>;
  deleteAttachment(attachmentId: string): Promise<DeleteAttachmentResult>;
  getAttachmentUrl(fileId: string): Promise<string | null>;
  listLeadAttachments(leadId: string): Promise<string[]>;
}
