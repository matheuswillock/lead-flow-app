import type { Output } from "@/lib/output";

export type CreateRequestInput = {
  leadId: string;
  teamId: string;
  profileId: string;
  documents: string[];
  message?: string;
};

export type UploadItemFile = {
  buffer: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export interface ILeadDocumentRequestUseCase {
  listRequests(leadId: string, teamId: string): Promise<Output>;
  createRequest(input: CreateRequestInput): Promise<Output>;
  resendEmail(requestId: string, teamId: string): Promise<Output>;
  getPublicRequest(publicToken: string): Promise<Output>;
  uploadItem(itemId: string, publicToken: string, file: UploadItemFile): Promise<Output>;
  processReminders(): Promise<Output>;
}
