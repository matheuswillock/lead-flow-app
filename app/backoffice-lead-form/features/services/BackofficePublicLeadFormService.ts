import type {
  IBackofficePublicLeadFormService,
  SubmitBackofficePublicLeadPayload,
  SubmitBackofficePublicLeadResult,
} from "./IBackofficePublicLeadFormService"

class BackofficePublicLeadFormService implements IBackofficePublicLeadFormService {
  private resolveTrackingPayload(): Pick<
    SubmitBackofficePublicLeadPayload,
    | "utmSource"
    | "utmMedium"
    | "utmCampaign"
    | "utmContent"
    | "utmTerm"
    | "landingUrl"
    | "referrer"
  > {
    if (typeof window === "undefined") {
      return {}
    }

    const currentUrl = new URL(window.location.href)
    const normalize = (value: string | null): string | undefined => {
      if (!value) return undefined
      const normalized = value.trim()
      return normalized.length > 0 ? normalized : undefined
    }

    return {
      utmSource: normalize(currentUrl.searchParams.get("utm_source")),
      utmMedium: normalize(currentUrl.searchParams.get("utm_medium")),
      utmCampaign: normalize(currentUrl.searchParams.get("utm_campaign")),
      utmContent: normalize(currentUrl.searchParams.get("utm_content")),
      utmTerm: normalize(currentUrl.searchParams.get("utm_term")),
      landingUrl: normalize(window.location.href),
      referrer: normalize(document.referrer),
    }
  }

  async submitLead(
    payload: SubmitBackofficePublicLeadPayload,
  ): Promise<SubmitBackofficePublicLeadResult> {
    const tracking = this.resolveTrackingPayload()
    const response = await fetch("/api/v1/backoffice/public-lead-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        ...tracking,
      }),
    })

    const result = await response.json()

    if (!response.ok || !result?.isValid) {
      const message =
        Array.isArray(result?.errorMessages) && result.errorMessages.length > 0
          ? result.errorMessages.join(", ")
          : "Erro ao enviar o formulário."
      throw new Error(message)
    }

    return {
      id: result.result?.id ?? "",
      duplicated: Boolean(result.result?.duplicated),
    }
  }
}

export const backofficePublicLeadFormService = new BackofficePublicLeadFormService()
