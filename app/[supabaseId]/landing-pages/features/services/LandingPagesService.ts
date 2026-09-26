import { API_CLIENT_BASE } from "@/lib/route-map"
import type { ILandingPagesService } from "./ILandingPagesService"

export function getLandingPagesApiUrl(teamId: string) {
  return `${API_CLIENT_BASE}/teams/${teamId}/landing-pages`
}

export function getLandingDomainApiUrl(teamId: string) {
  return `${getLandingPagesApiUrl(teamId)}/domain`
}

export function getEmailSettingsApiUrl() {
  return `${API_CLIENT_BASE}/email/settings`
}

export const landingPagesService: ILandingPagesService = {
  getLandingPagesApiUrl,
  getLandingDomainApiUrl,
  getEmailSettingsApiUrl,
}
