import type { SupportRequestAttachmentInput } from "@/app/api/useCases/support/ISupportRequestUseCase";

export interface SupportRequestData {
  supportId: string;
  subject: string;
  message: string;
  requesterName: string;
  requesterEmail: string;
  attachments?: SupportRequestAttachmentInput[];
}

export interface ISupportRequestService {
  sendSupportRequest(data: SupportRequestData): Promise<{ success: boolean; error?: string }>;
}
