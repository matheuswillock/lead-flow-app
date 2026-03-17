import { Output } from "@/lib/output";

export type SupportRequestAttachmentInput = {
  fileName: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

export type CreateSupportRequestInput = {
  subject: string;
  message: string;
  requesterName: string;
  requesterEmail: string;
  attachments?: SupportRequestAttachmentInput[];
};

export interface ISupportRequestUseCase {
  createSupportRequest(input: CreateSupportRequestInput): Promise<Output>;
}
