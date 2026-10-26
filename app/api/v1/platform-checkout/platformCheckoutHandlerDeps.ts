import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { EmailCreditUseCase } from "@/app/api/useCases/email/EmailCreditUseCase"
import { platformCheckoutUseCase } from "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"
import { getAuthenticatedSupabaseId } from "@/app/api/v1/utils/getAuthenticatedSupabaseId"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { PlatformCheckoutHandlerDeps } from "./platformCheckoutHandlers"

export function buildPlatformCheckoutHandlerDeps(): PlatformCheckoutHandlerDeps {
  const emailCredits = new EmailCreditUseCase()
  return {
    getTeamAccess,
    getAuthenticatedSupabaseId,
    findProfileIdBySupabaseId: async (supabaseId) =>
      (await profileRepository.findBySupabaseId(supabaseId))?.id ?? null,
    subscribeEmailCredits: (plan, access, billingType) => emailCredits.subscribe(plan, access, billingType),
    getCheckoutDetailsForOwner: (checkoutId, ownerProfileId) =>
      platformCheckoutUseCase.getCheckoutDetailsForOwner(checkoutId, ownerProfileId),
  }
}
