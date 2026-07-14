import type { AcceptanceForm, AcceptancePageData, AcceptanceResult } from "../context/AcceptanceTypes"
import type { IAcceptanceService } from "./IAcceptanceService"

type ApiOutput<T> = { isValid: boolean; errorMessages: string[]; result: T }

async function parse<T>(response: Response): Promise<T> {
  const output = await response.json() as ApiOutput<T>
  if (!output.isValid) {
    const error = new Error(output.errorMessages?.[0] ?? "Não foi possível concluir a operação") as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return output.result
}

export class AcceptanceService implements IAcceptanceService {
  async getData(): Promise<AcceptancePageData> {
    return parse(await fetch("/api/v1/backoffice/adhesions/acceptance", { cache: "no-store", credentials: "same-origin" }))
  }

  async submit(data: AcceptancePageData, form: AcceptanceForm): Promise<AcceptanceResult> {
    return parse(await fetch("/api/v1/backoffice/adhesions/acceptance", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        form,
        documentSetId: data.documentSet.id,
        displayedDocuments: data.documentSet.documents.map((document) => ({ legalDocumentId: document.id, contentHash: document.contentHash })),
      }),
    }))
  }
}

export const acceptanceService = new AcceptanceService()

