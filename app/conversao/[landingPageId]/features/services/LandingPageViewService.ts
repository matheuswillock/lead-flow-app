import type { ILandingPageViewService } from "./ILandingPageViewService"

export const landingPageViewService: ILandingPageViewService = {
  getPublicUrl: (landingPageId) => `/conversao/${landingPageId}`,
}
