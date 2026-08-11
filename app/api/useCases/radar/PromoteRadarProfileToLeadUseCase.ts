import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository"
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"

const leadRepository = new LeadRepository()

type PromotionProfile = NonNullable<
  Awaited<ReturnType<typeof radarRepository.getProfileForPromotionWithCtx>>
>

function profileHasLeadIdentity(profile: PromotionProfile): boolean {
  return profile.identities.some((identity) => identity.type === "lead_id")
}

function resolvePromotionEmail(profile: PromotionProfile): string | undefined {
  if (profile.primaryEmail?.trim()) return profile.primaryEmail.trim()
  const emailIdentity = profile.identities.find((identity) => identity.type === "email")
  const value = emailIdentity?.value?.trim() || emailIdentity?.normalizedValue?.trim()
  return value || undefined
}

function resolvePromotionPhone(profile: PromotionProfile): string | undefined {
  const digits = (profile.normalizedPhone ?? profile.displayPhone ?? "").replace(/\D/g, "")
  return digits.length >= 10 ? digits : undefined
}

function buildPromotionNotes(hasPhone: boolean): string {
  const lines = ["Lead criado a partir de perfil Radar (promoção manual)."]
  if (!hasPhone) {
    lines.push("⚠️ Contato promovido do Radar sem telefone — enriquecer manualmente.")
  }
  return lines.join("\n")
}

class PromoteRadarProfileToLeadUseCase {
  async execute(input: {
    profileId: string
    access: TeamAccess
    ctx: TeamContext
  }): Promise<Output> {
    try {
      const scope = { teamId: input.access.teamId, ctx: input.ctx }
      const profile = await radarRepository.getProfileForPromotionWithCtx(scope, input.profileId)

      if (!profile) {
        return new Output(false, [], ["Perfil Radar não encontrado neste time"], null)
      }

      if (profileHasLeadIdentity(profile)) {
        return new Output(
          false,
          [],
          ["Este perfil Radar já está vinculado a um Lead"],
          null
        )
      }

      const phone = resolvePromotionPhone(profile)
      const email = resolvePromotionEmail(profile)
      const createOutput = await leadUseCase.createLead(
        input.access.supabaseId,
        {
          name: profile.displayName.trim() || "Contato Radar",
          email,
          phone,
          originChannel: "manual",
          originMetadata: {
            source: "radar_profile_promote",
            radarProfileId: profile.id,
          },
          notes: buildPromotionNotes(Boolean(phone)),
        } as unknown as CreateLeadRequest,
        input.access.teamId
      )

      if (!createOutput.isValid) {
        return createOutput
      }

      const createdLead = createOutput.result as { id?: string } | null
      if (!createdLead?.id) {
        return new Output(false, [], ["Erro ao criar Lead a partir do perfil Radar"], null)
      }

      const claimed = await radarRepository.tryInsertLeadIdentityIfAbsent(
        scope,
        profile.id,
        createdLead.id
      )

      if (!claimed) {
        try {
          await leadRepository.delete(createdLead.id)
        } catch (rollbackError) {
          console.error(
            "[PromoteRadarProfileToLeadUseCase][execute] Falha ao remover Lead órfão após corrida de promoção:",
            rollbackError
          )
        }
        return new Output(
          false,
          [],
          ["Este perfil Radar já foi promovido a Lead por outra operação"],
          null
        )
      }

      const syncOutput = await syncLeadToRadarUseCase.execute({
        leadId: createdLead.id,
        teamId: input.access.teamId,
      })

      if (!syncOutput.isValid) {
        console.error(
          "[PromoteRadarProfileToLeadUseCase][execute] sync Lead→Radar falhou após promoção:",
          syncOutput.errorMessages
        )
      }

      return new Output(
        true,
        ["Lead criado e vinculado ao perfil Radar"],
        [],
        { leadId: createdLead.id, radarProfileId: profile.id }
      )
    } catch (error) {
      console.error("[PromoteRadarProfileToLeadUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao promover perfil Radar a Lead"
      return new Output(false, [], [message], null)
    }
  }
}

export const promoteRadarProfileToLeadUseCase = new PromoteRadarProfileToLeadUseCase()
