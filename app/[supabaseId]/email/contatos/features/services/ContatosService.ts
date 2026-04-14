"use client";

import type { ContactList, Contact } from "../context/ContatosTypes";

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
  deleteContact(listId: string, contactId: string): Promise<void>
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

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.errorMessages?.join(", ") || "Erro ao excluir lista de contatos"
      );
    }
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
}
