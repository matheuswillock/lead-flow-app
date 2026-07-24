import type {
  IBackofficeClientEmailTemplateEditorService,
} from "./IBackofficeClientEmailTemplateEditorService"
import type { StudioEmailTemplateDetail } from "../context/BackofficeClientEmailTemplateEditorTypes"

interface ApiOutput<T> {
  isValid: boolean
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !json?.isValid) {
    throw new Error(json?.errorMessages?.[0] ?? `HTTP ${response.status}`)
  }
  return json.result
}

export class BackofficeClientEmailTemplateEditorService
  implements IBackofficeClientEmailTemplateEditorService
{
  async getTemplate(
    masterId: string,
    teamId: string,
    templateId: string
  ): Promise<StudioEmailTemplateDetail> {
    const response = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}/email/templates/${templateId}`,
      { cache: "no-store" }
    )
    return parseOutput(response)
  }

  async updateTemplate(
    masterId: string,
    teamId: string,
    templateId: string,
    data: { name: string; subject: string; html: string }
  ): Promise<StudioEmailTemplateDetail> {
    const response = await fetch(
      `/api/v1/backoffice/platform-users/${masterId}/teams/${teamId}/email/templates/${templateId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    )
    return parseOutput(response)
  }
}

export const backofficeClientEmailTemplateEditorService =
  new BackofficeClientEmailTemplateEditorService()
