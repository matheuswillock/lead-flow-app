import { API_CLIENT_BASE } from "@/lib/route-map"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"

type FormDomainApiOutput = {
  isValid: boolean
  result: {
    formDomain: { hostname: string; status: string } | null
  } | null
}

export class PublicFormShareBaseUrlClientService implements IPublicFormShareBaseUrlClientService {
  async getVerifiedFormDomainBaseUrl(): Promise<string | null> {
    const res = await fetch(`${API_CLIENT_BASE}/email/settings/form-domain`)
    if (!res.ok) return null

    const json = (await res.json().catch(() => null)) as FormDomainApiOutput | null
    const formDomain = json?.isValid ? json.result?.formDomain : null
    if (!formDomain || formDomain.status !== "verified") return null

    return `https://${formDomain.hostname}`
  }
}

export const publicFormShareBaseUrlClientService = new PublicFormShareBaseUrlClientService()
