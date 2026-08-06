import type { DocumentRequestData } from "../context/DocumentRequestTypes";

export interface IDocumentRequestService {
  getByToken(token: string): Promise<DocumentRequestData>;
  uploadItem(token: string, itemId: string, file: File): Promise<void>;
}
