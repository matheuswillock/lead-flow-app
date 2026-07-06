import type {
  OperationalAccessGrantItem,
  OperationalAccessListResult,
} from "../context/BackofficeOperationalAccessTypes"
import type { IBackofficeOperationalAccessService } from "./IBackofficeOperationalAccessService"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? "Erro ao processar solicitação")
  }
  return data.result
}

export class BackofficeOperationalAccessService implements IBackofficeOperationalAccessService {
  async list(): Promise<OperationalAccessListResult> {
    return parseOutput<OperationalAccessListResult>(
      await fetch("/api/v1/backoffice/operational-access", { cache: "no-store" })
    )
  }

  async grantAssociados(profileId: string, notes?: string | null): Promise<OperationalAccessGrantItem> {
    return parseOutput<OperationalAccessGrantItem>(
      await fetch("/api/v1/backoffice/operational-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: "ASSOCIADOS_QUEUE",
          profileId,
          notes: notes ?? null,
        }),
      })
    )
  }

  async grantMultiskill(masterId: string, notes?: string | null): Promise<OperationalAccessGrantItem> {
    return parseOutput<OperationalAccessGrantItem>(
      await fetch("/api/v1/backoffice/operational-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: "MULTISKILL_TRANSFER_ORIGIN",
          masterId,
          notes: notes ?? null,
        }),
      })
    )
  }

  async revoke(grantId: string): Promise<OperationalAccessGrantItem> {
    return parseOutput<OperationalAccessGrantItem>(
      await fetch(`/api/v1/backoffice/operational-access/${grantId}`, {
        method: "DELETE",
      })
    )
  }
}

export const backofficeOperationalAccessService = new BackofficeOperationalAccessService()
