import type {
  BackofficeAccountData,
  BackofficeAccountUpdateInput,
  BackofficeGoogleScopesResult,
} from "../context/BackofficeAccountTypes"
import type { IBackofficeAccountService } from "./IBackofficeAccountService"

interface ApiOutput<T> {
  isValid: boolean
  successMessages: string[]
  errorMessages: string[]
  result: T
}

async function parseOutput<T>(response: Response): Promise<ApiOutput<T>> {
  const json = (await response.json().catch(() => null)) as ApiOutput<T> | null
  if (!response.ok || !json?.isValid) {
    throw new Error(json?.errorMessages?.[0] ?? `HTTP ${response.status}`)
  }
  return json
}

export class BackofficeAccountService implements IBackofficeAccountService {
  async getAccount(): Promise<BackofficeAccountData> {
    const response = await fetch("/api/v1/backoffice/account", { cache: "no-store" })
    const output = await parseOutput<BackofficeAccountData>(response)
    return output.result
  }

  async updateAccount(input: BackofficeAccountUpdateInput): Promise<BackofficeAccountData> {
    const response = await fetch("/api/v1/backoffice/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const output = await parseOutput<BackofficeAccountData>(response)
    return output.result
  }

  async updatePassword(password: string): Promise<void> {
    const response = await fetch("/api/v1/backoffice/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    await parseOutput<null>(response)
  }

  async uploadIcon(file: File): Promise<{ iconId: string; publicUrl: string }> {
    const formData = new FormData()
    formData.set("icon", file)
    const response = await fetch("/api/v1/backoffice/account/icon", {
      method: "POST",
      body: formData,
    })
    const output = await parseOutput<{ iconId: string; publicUrl: string }>(response)
    return output.result
  }

  async removeIcon(): Promise<void> {
    const response = await fetch("/api/v1/backoffice/account/icon", { method: "DELETE" })
    await parseOutput<null>(response)
  }

  async updateTimezone(timezone: string): Promise<string> {
    const response = await fetch("/api/v1/backoffice/account/timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    })
    const output = await parseOutput<{ timezone: string }>(response)
    return output.result.timezone
  }

  async getGoogleScopes(): Promise<BackofficeGoogleScopesResult> {
    const response = await fetch("/api/v1/backoffice/account/google-scopes", {
      cache: "no-store",
    })
    const output = await parseOutput<BackofficeGoogleScopesResult>(response)
    return output.result
  }

  async disconnectGoogle(): Promise<void> {
    const response = await fetch("/api/v1/backoffice/google/disconnect", {
      method: "POST",
    })
    await parseOutput<null>(response)
  }
}
