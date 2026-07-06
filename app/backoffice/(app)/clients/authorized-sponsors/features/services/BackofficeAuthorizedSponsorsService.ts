import type {
  AuthorizedSponsorsListResult,
  EligibleMasterOption,
  AuthorizedSponsorItem,
} from "../context/BackofficeAuthorizedSponsorsTypes"
import type { IBackofficeAuthorizedSponsorsService } from "./IBackofficeAuthorizedSponsorsService"

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

export class BackofficeAuthorizedSponsorsService implements IBackofficeAuthorizedSponsorsService {
  async list(): Promise<AuthorizedSponsorsListResult> {
    return parseOutput<AuthorizedSponsorsListResult>(
      await fetch("/api/v1/backoffice/authorized-sponsors", { cache: "no-store" })
    )
  }

  async grant(profileId: string, notes?: string | null): Promise<AuthorizedSponsorItem> {
    return parseOutput<AuthorizedSponsorItem>(
      await fetch("/api/v1/backoffice/authorized-sponsors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, notes: notes ?? null }),
      })
    )
  }

  async revoke(profileId: string): Promise<AuthorizedSponsorItem> {
    return parseOutput<AuthorizedSponsorItem>(
      await fetch(`/api/v1/backoffice/authorized-sponsors/${profileId}`, {
        method: "DELETE",
      })
    )
  }
}

export const backofficeAuthorizedSponsorsService = new BackofficeAuthorizedSponsorsService()

export type { EligibleMasterOption, AuthorizedSponsorItem }
