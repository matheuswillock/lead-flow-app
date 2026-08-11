export type SendRequestEmailData = {
  teamId: string;
  requestId: string;
  closerName: string;
  leadName: string;
  publicUrl: string;
  documents: string[];
  message?: string;
};

export type SendUploadNotificationEmailData = {
  teamId: string;
  documentId: string;
  closerName: string;
  leadName: string;
  documentName: string;
  leadCode: string;
  supabaseId: string;
  appUrl: string;
};

export interface ILeadDocumentRequestService {
  sendRequestEmail(to: string, data: SendRequestEmailData): Promise<void>;
  sendUploadNotificationEmail(to: string, data: SendUploadNotificationEmailData): Promise<void>;
}
