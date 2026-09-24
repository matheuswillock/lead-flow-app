import { API_CLIENT_BASE } from "@/lib/route-map"
import type { IPublicFormShareBaseUrlClientService } from "./IPublicFormShareBaseUrlClientService"

type FormDomainApiOutput = {
  isValid: boolean
  result: {
    formDomain: { hostname: string; status: string } | null
  } | null
}

export class PublicFormShareBaseUrlClientService implements IPublicFormShareBaseUrlClientService {
  async getFormDomain(): Promise<{ hostname: string | null; isVerified: boolean }> {
    const res = await fetch(`${API_CLIENT_BASE}/email/settings/form-domain`)
    if (!res.ok) return { hostname: null, isVerified: false }

    const json = (await res.json().catch(() => null)) as FormDomainApiOutput | null
    const formDomain = json?.isValid ? json.result?.formDomain : null
    return {
      hostname: formDomain?.hostname ?? null,
      isVerified: formDomain?.status === "verified",
    }
  }

  async getVerifiedFormDomainBaseUrl(): Promise<string | null> {
    const domain = await this.getFormDomain()
    return domain.isVerified && domain.hostname ? `https://${domain.hostname}` : null
  }
}

export const publicFormShareBaseUrlClientService = new PublicFormShareBaseUrlClientService()
