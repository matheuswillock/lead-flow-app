import type {
  BackofficeEmailContactListItem,
  BackofficeEmailContactsPage,
} from "../context/BackofficeEmailContatosTypes"
import type { IBackofficeEmailContatosService } from "./IBackofficeEmailContatosService"

interface BackofficeApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as BackofficeApiOutput<T> | null
  if (!response.ok || !json || !json.isValid) {
    const message = json?.errorMessages?.[0] ?? `HTTP ${response.status}`
    throw new Error(message)
  }
  return json.result
}

const BASE_URL = "/api/v1/backoffice/email-campaigns/contact-lists"

export class BackofficeEmailContatosService implements IBackofficeEmailContatosService {
  async listContactLists(): Promise<BackofficeEmailContactListItem[]> {
    const response = await fetch(BASE_URL, { method: "GET", cache: "no-store" })
    return parseOutput<BackofficeEmailContactListItem[]>(response)
  }

  async createContactList(name: string): Promise<BackofficeEmailContactListItem> {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
    return parseOutput<BackofficeEmailContactListItem>(response)
  }

  async archiveContactList(id: string): Promise<BackofficeEmailContactListItem> {
    const response = await fetch(`${BASE_URL}/${id}`, { method: "DELETE" })
    return parseOutput<BackofficeEmailContactListItem>(response)
  }

  async uploadContacts(listId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch(`${BASE_URL}/${listId}/upload`, {
      method: "POST",
      body: formData,
    })
    await parseOutput<unknown>(response)
  }

  async listContacts(
    listId: string,
    page: number,
    pageSize: number
  ): Promise<BackofficeEmailContactsPage> {
    const response = await fetch(
      `${BASE_URL}/${listId}/contacts?page=${page}&pageSize=${pageSize}`,
      { method: "GET", cache: "no-store" }
    )
    return parseOutput<BackofficeEmailContactsPage>(response)
  }

  async deleteContact(listId: string, contactId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${listId}/contacts/${contactId}`, {
      method: "DELETE",
    })
    await parseOutput<unknown>(response)
  }
}
