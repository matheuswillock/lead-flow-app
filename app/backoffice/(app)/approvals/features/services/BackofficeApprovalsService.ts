import type { IBackofficeApprovalsService } from "./IBackofficeApprovalsService"
import type {
  BackofficeApprovalDecisionResult,
  BackofficeApprovalsFilters,
  BackofficeApprovalsListResult,
  BackofficeDeletionApprovalDecision,
} from "../context/BackofficeApprovalsTypes"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response, fallbackMessage: string): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false
  if (!isJson) {
    throw new Error(fallbackMessage)
  }

  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? fallbackMessage)
  }

  return data.result
}

export class BackofficeApprovalsService implements IBackofficeApprovalsService {
  async list(params?: { filters?: Partial<BackofficeApprovalsFilters> }): Promise<BackofficeApprovalsListResult> {
    const search = new URLSearchParams()
    const status = params?.filters?.status
    if (status && status !== "all") {
      search.set("status", status)
    }

    const query = search.toString()
    const url = query
      ? `/api/v1/backoffice/deletion-requests?${query}`
      : "/api/v1/backoffice/deletion-requests"

    return parseOutput<BackofficeApprovalsListResult>(
      await fetch(url, { cache: "no-store" }),
      "Erro ao carregar aprovações"
    )
  }

  async decide(
    requestId: string,
    decision: BackofficeDeletionApprovalDecision
  ): Promise<BackofficeApprovalDecisionResult> {
    return parseOutput<BackofficeApprovalDecisionResult>(
      await fetch(`/api/v1/backoffice/deletion-requests/${encodeURIComponent(requestId)}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      }),
      "Erro ao registrar decisão"
    )
  }
}
