"use client";

import type { EmailContactImportRow } from "@/lib/emailContactImport/emailContactImportFields";
import type { ContactList, Contact } from "../context/ContatosTypes";
import type { EmailContactImportResult } from "./IContatosService";

export const IMPORT_BATCH_SIZE = 25;

type OutputResponse = {
  isValid?: boolean
  errorMessages?: string[]
  result?: EmailContactImportResult
};

function mergeImportResults(
  current: EmailContactImportResult,
  batch: EmailContactImportResult
): EmailContactImportResult {
  return {
    imported: current.imported + batch.imported,
    updated: current.updated + batch.updated,
    skipped: current.skipped + batch.skipped,
    total: batch.total,
    issues: [...current.issues, ...batch.issues],
  };
}

function getImportHttpErrorMessage(status: number): string {
  if (status === 504 || status === 502) {
    return "A importação demorou demais e foi interrompida. Tente novamente — os contatos já importados foram salvos.";
  }
  if (status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 403) {
    return "Você não tem permissão para importar contatos.";
  }
  return "Erro ao importar contatos";
}

async function parseImportResponse(response: Response): Promise<OutputResponse> {
  const text = await response.text();

  if (!text) {
    if (!response.ok) {
      throw new Error(getImportHttpErrorMessage(response.status));
    }
    return {};
  }

  try {
    return JSON.parse(text) as OutputResponse;
  } catch {
    throw new Error(getImportHttpErrorMessage(response.status));
  }
}

export interface IContatosService {
  getLists(): Promise<ContactList[]>
  createList(data: { name: string; description?: string }): Promise<ContactList>
  deleteList(id: string): Promise<void>
  getContacts(
    listId: string,
    page: number,
    pageSize: number,
    search: string
  ): Promise<{
    contacts: Contact[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
  uploadCsv(
    listId: string,
    file: File
  ): Promise<{ imported: number; updated: number; total: number }>
  importMapped(listId: string, rows: EmailContactImportRow[]): Promise<EmailContactImportResult>
  importMappedInBatches(
    listId: string,
    rows: EmailContactImportRow[],
    options?: {
      onProgress?: (processed: number, total: number) => void
    }
  ): Promise<EmailContactImportResult>
  deleteContact(listId: string, contactId: string): Promise<void>
  addContact(listId: string, email: string, name?: string): Promise<void>
}

export class ContatosService implements IContatosService {
  private readonly baseUrl = "/api/v1/email/contact-lists";

  async getLists(): Promise<ContactList[]> {
    console.info("[ContatosService] getLists");
    const response = await fetch(this.baseUrl, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok || !data.isValid) {
      throw new Error(
        data.errorMessages?.join(", ") || "Erro ao carregar listas de contatos"
      );
    }

    return data.result as ContactList[];
  }

  async createList(payload: {
    name: string
    description?: string
  }): Promise<ContactList> {
    console.info("[ContatosService] createList", payload.name);
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.isValid) {
      throw new Error(
        data.errorMessages?.join(", ") || "Erro ao criar lista de contatos"
      );
    }

    return data.result as ContactList;
  }

  async deleteList(id: string): Promise<void> {
    console.info("[ContatosService] deleteList", id);
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.errorMessages?.join(", ") || "Erro ao excluir lista de contatos"
      );
    }
  }

  async importMapped(
    listId: string,
    rows: EmailContactImportRow[]
  ): Promise<EmailContactImportResult> {
    console.info("[ContatosService] importMapped", { listId, rowCount: rows.length });
    const response = await fetch(`${this.baseUrl}/${listId}/import/mapped`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });

    const data = await parseImportResponse(response);
    if (!response.ok || !data.isValid) {
      throw new Error(
        data.errorMessages?.join(", ") || getImportHttpErrorMessage(response.status)
      );
    }

    return data.result as EmailContactImportResult;
  }

  async importMappedInBatches(
    listId: string,
    rows: EmailContactImportRow[],
    options?: {
      onProgress?: (processed: number, total: number) => void
    }
  ): Promise<EmailContactImportResult> {
    const total = rows.length;
    let aggregated: EmailContactImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      issues: [],
    };

    options?.onProgress?.(0, total);

    for (let index = 0; index < rows.length; index += IMPORT_BATCH_SIZE) {
      const batch = rows.slice(index, index + IMPORT_BATCH_SIZE);
      const batchResult = await this.importMapped(listId, batch);
      aggregated = mergeImportResults(aggregated, batchResult);
      options?.onProgress?.(Math.min(index + batch.length, total), total);
    }

    return aggregated;
  }

  async getContacts(
    listId: string,
    page: number,
    pageSize: number,
    search: string
  ): Promise<{
    contacts: Contact[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    console.info("[ContatosService] getContacts", { listId, page, search });
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) {
      params.set("search", search);
    }

    const response = await fetch(
      `${this.baseUrl}/${listId}/contacts?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      }
    );

    const data = await response.json();
    if (!response.ok || !data.isValid) {
      throw new Error(
        data.errorMessages?.join(", ") || "Erro ao carregar contatos"
      );
    }

    return data.result as {
      contacts: Contact[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    };
  }

  async uploadCsv(
    listId: string,
    file: File
  ): Promise<{ imported: number; updated: number; total: number }> {
    console.info("[ContatosService] uploadCsv", { listId, fileName: file.name });
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/${listId}/upload`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok || !data.isValid) {
      throw new Error(
        data.errorMessages?.join(", ") || "Erro ao importar CSV"
      );
    }

    return data.result as { imported: number; updated: number; total: number };
  }

  async deleteContact(listId: string, contactId: string): Promise<void> {
    console.info("[ContatosService] deleteContact", { listId, contactId });
    const response = await fetch(
      `${this.baseUrl}/${listId}/contacts/${contactId}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.errorMessages?.join(", ") || "Erro ao excluir contato"
      );
    }
  }

  async addContact(listId: string, email: string, name?: string): Promise<void> {
    console.info("[ContatosService] addContact", { listId, email });
    const response = await fetch(`${this.baseUrl}/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.isValid) {
      throw new Error(
        data?.errorMessages?.join(", ") || "Erro ao adicionar contato"
      );
    }
  }
}
