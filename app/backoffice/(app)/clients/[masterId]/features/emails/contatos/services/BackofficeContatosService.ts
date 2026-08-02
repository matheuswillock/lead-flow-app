import type { ContactList } from "@/app/[supabaseId]/email/contatos/features/context/ContatosTypes"
import type {
  StudioEmailContatosService,
  StudioEmailCreateListData,
  StudioEmailContactImportEnqueueResult,
  StudioEmailGetContactsResult,
  StudioEmailUploadCsvResult,
} from "@/lib/email/studio-email-service-contracts"
import type { EmailContactImportRow } from "@/lib/emailContactImport/emailContactImportFields"
import { parseStudioEmailOutput, studioEmailBasePath } from "@/lib/email/backoffice-studio-email-api"

export class BackofficeContatosService implements StudioEmailContatosService {
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

  async createList(data: StudioEmailCreateListData): Promise<ContactList> {
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
  ): Promise<StudioEmailGetContactsResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set("search", search)
    const response = await fetch(`${this.base()}/${listId}/contacts?${params}`)
    return parseStudioEmailOutput<StudioEmailGetContactsResult>(response)
  }

  async uploadCsv(listId: string, file: File): Promise<StudioEmailUploadCsvResult> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${this.base()}/${listId}/upload`, {
      method: "POST",
      body: formData,
    })
    return parseStudioEmailOutput<StudioEmailUploadCsvResult>(response)
  }

  async importMapped(
    listId: string,
    rows: EmailContactImportRow[]
  ): Promise<StudioEmailContactImportEnqueueResult> {
    const response = await fetch(`${this.base()}/${listId}/import/mapped`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
    return parseStudioEmailOutput<StudioEmailContactImportEnqueueResult>(response)
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

  async setListRadarSegment(_listId: string, _segmentId: string | null): Promise<void> {
    // Backoffice host does not expose radar segment management
  }
}
