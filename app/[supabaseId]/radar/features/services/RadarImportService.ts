import type {
  IRadarImportService,
  RadarFieldDefinition,
  RadarImportEnqueueResult,
  RadarImportJobStatus,
  RadarImportUploadResult,
} from "./IRadarImportService"

async function parseOutput<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (!json.isValid) throw new Error(json.errorMessages?.join(", ") ?? "Erro na requisição")
  return json.result as T
}

export class RadarImportService implements IRadarImportService {
  private readonly baseUrl = "/api/v1/radar"

  private buildHeaders(supabaseId: string, teamId: string): HeadersInit {
    return {
      "x-supabase-user-id": supabaseId,
      "x-team-id": teamId,
    }
  }

  async uploadFile(supabaseId: string, teamId: string, file: File): Promise<RadarImportUploadResult> {
    const formData = new FormData()
    formData.set("file", file)

    const res = await fetch(`${this.baseUrl}/import/upload`, {
      method: "POST",
      headers: this.buildHeaders(supabaseId, teamId),
      body: formData,
    })

    return parseOutput<RadarImportUploadResult>(res)
  }

  async enqueueMappedImport(
    supabaseId: string,
    teamId: string,
    payload: {
      importId: string
      storagePath: string
      baseName: string
      fieldMapping: Record<string, string>
      sourceFormat: string
      totalRows: number
    }
  ): Promise<RadarImportEnqueueResult> {
    const res = await fetch(`${this.baseUrl}/import/mapped`, {
      method: "POST",
      headers: {
        ...this.buildHeaders(supabaseId, teamId),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    return parseOutput<RadarImportEnqueueResult>(res)
  }

  async getJobStatus(
    supabaseId: string,
    teamId: string,
    importId: string
  ): Promise<RadarImportJobStatus> {
    const res = await fetch(`${this.baseUrl}/import/jobs/${importId}`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })

    return parseOutput<RadarImportJobStatus>(res)
  }

  async listFieldDefinitions(supabaseId: string, teamId: string): Promise<RadarFieldDefinition[]> {
    const res = await fetch(`${this.baseUrl}/field-definitions`, {
      cache: "no-store",
      headers: this.buildHeaders(supabaseId, teamId),
    })
    const result = await parseOutput<{ definitions: RadarFieldDefinition[] }>(res)
    return result.definitions ?? []
  }
}

export const radarImportService = new RadarImportService()
