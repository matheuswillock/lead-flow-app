export interface AttachmentUploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  error?: string;
}
