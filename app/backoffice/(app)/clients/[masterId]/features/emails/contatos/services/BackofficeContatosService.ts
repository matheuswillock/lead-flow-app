import type { ContactList } from "@/app/[supabaseId]/email/contatos/features/context/ContatosTypes"
import type {
  CreateListData,
  EmailContactImportEnqueueResult,
  GetContactsResult,
  IContatosService,
  UploadCsvResult,
} from "@/app/[supabaseId]/email/contatos/features/services/IContatosService"
import type { EmailContactImportRow } from "@/lib/emailContactImport/emailContactImportFields"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeContatosService implements IContatosService {
  constructor(
    private readonly masterId: string,
    private readonly teamId: string
  ) {}

  private base(): string {
    return `${studioEmailBasePath(this.masterId, this.teamId)}/contact-lists`
  }

  async getLists(): Promise<ContactList[]> {
    const response = await fetch(this.base())
    return parseStudioEmailOutput<ContactList[]>(response)
  }

  async createList(data: CreateListData): Promise<ContactList> {
    const response = await fetch(this.base(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    return parseStudioEmailOutput<ContactList>(response)
  }

  async deleteList(id: string): Promise<void> {
    const response = await fetch(`${this.base()}/${id}`, { method: "DELETE" })
    if (!response.ok) await parseStudioEmailOutput<unknown>(response)
  }

  async getContacts(
    listId: string,
    page: number,
    pageSize: number,
    search: string
  ): Promise<GetContactsResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set("search", search)
    const response = await fetch(`${this.base()}/${listId}/contacts?${params}`)
    return parseStudioEmailOutput<GetContactsResult>(response)
  }

  async uploadCsv(listId: string, file: File): Promise<UploadCsvResult> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${this.base()}/${listId}/upload`, {
      method: "POST",
      body: formData,
    })
    return parseStudioEmailOutput<UploadCsvResult>(response)
  }

  async importMapped(
    listId: string,
    rows: EmailContactImportRow[]
  ): Promise<EmailContactImportEnqueueResult> {
    const response = await fetch(`${this.base()}/${listId}/import/mapped`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
    return parseStudioEmailOutput<EmailContactImportEnqueueResult>(response)
  }

  async deleteContact(listId: string, contactId: string): Promise<void> {
    const response = await fetch(`${this.base()}/${listId}/contacts/${contactId}`, {
      method: "DELETE",
    })
    if (!response.ok) await parseStudioEmailOutput<unknown>(response)
  }

  async addContact(listId: string, email: string, name?: string): Promise<void> {
    const response = await fetch(`${this.base()}/${listId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    })
    await parseStudioEmailOutput<unknown>(response)
  }
}
