import { Output } from "@/lib/output"
import { normalizeLeadPhoneDigits } from "@/lib/masks"
import { isBrazilianContactPhone, isValidPersonLeadName } from "@/lib/public-forms/lead-identity"
import type {
  IRadarLeadGateUnitOfWork,
  RadarLeadGateProfile,
} from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"

export type RadarProfileLeadEligibility = {
  eligible: boolean
  reason: "eligible" | "profile_not_found" | "invalid_name" | "invalid_phone"
}

export class EvaluateRadarProfileLeadEligibilityUseCase {
  constructor(private readonly unitOfWork: IRadarLeadGateUnitOfWork) {}

  evaluateProfile(profile: RadarLeadGateProfile): RadarProfileLeadEligibility {
    if (!isValidPersonLeadName(profile.displayName, profile.primaryEmail ?? undefined)) {
      return { eligible: false, reason: "invalid_name" }
    }

    const normalizedPhone = normalizeLeadPhoneDigits(
      profile.normalizedPhone ?? profile.displayPhone ?? "",
    )
    if (!isBrazilianContactPhone(normalizedPhone)) {
      return { eligible: false, reason: "invalid_phone" }
    }

    return { eligible: true, reason: "eligible" }
  }

  async execute(input: { teamId: string; radarProfileId: string }): Promise<Output> {
    try {
      return await this.unitOfWork.execute(input, async (transaction) => {
        const profile = await transaction.reloadProfile(input.teamId, input.radarProfileId)
        if (!profile) {
          return new Output(true, [], [], {
            eligible: false,
            reason: "profile_not_found",
          } satisfies RadarProfileLeadEligibility)
        }
        return new Output(true, [], [], this.evaluateProfile(profile))
      })
    } catch (error) {
      console.error("[EvaluateRadarProfileLeadEligibilityUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao avaliar elegibilidade do perfil Radar"
      return new Output(false, [], [message], null)
    }
  }
}
