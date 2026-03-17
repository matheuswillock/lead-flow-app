import type { Attachment } from "resend";

export interface SupportRequestData {
  supportId: string;
  subject: string;
  message: string;
  requesterName: string;
  requesterEmail: string;
  attachments?: Attachment[];
}

export interface ISupportRequestService {
  sendSupportRequest(data: SupportRequestData): Promise<{ success: boolean; error?: string }>;
}
