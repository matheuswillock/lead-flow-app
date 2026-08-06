import type { DocumentRequestData } from "../context/DocumentRequestTypes";
import type { IDocumentRequestService } from "./IDocumentRequestService";

export class DocumentRequestService implements IDocumentRequestService {
  async getByToken(token: string): Promise<DocumentRequestData> {
    const res = await fetch(`/api/public/document-requests/${token}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.isValid === false) {
      throw new Error(data?.errorMessages?.[0] ?? "Solicitação não encontrada");
    }
    const result = (data?.result ?? data) as DocumentRequestData;
    if (!result?.id || !Array.isArray(result.items)) {
      throw new Error("Resposta inválida da solicitação");
    }
    return result;
  }

  async uploadItem(token: string, itemId: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(
      `/api/public/document-requests/${token}/items/${itemId}/upload`,
      { method: "POST", body: formData }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.isValid === false) {
      throw new Error(data?.errorMessages?.[0] ?? "Falha no upload");
    }
  }
}

export const documentRequestService = new DocumentRequestService();
