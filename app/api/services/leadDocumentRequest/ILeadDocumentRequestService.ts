export type SendRequestEmailData = {
  closerName: string;
  leadName: string;
  publicUrl: string;
  documents: string[];
  message?: string;
};

export type SendUploadNotificationEmailData = {
  closerName: string;
  leadName: string;
  documentName: string;
  leadId: string;
  appUrl: string;
};

export interface ILeadDocumentRequestService {
  sendRequestEmail(to: string, data: SendRequestEmailData): Promise<void>;
  sendUploadNotificationEmail(to: string, data: SendUploadNotificationEmailData): Promise<void>;
}
