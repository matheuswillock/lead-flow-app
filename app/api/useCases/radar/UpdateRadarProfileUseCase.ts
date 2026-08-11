import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import type { RadarGender } from "@/lib/radar/gender"

class UpdateRadarProfileUseCase {
  async execute(input: {
    profileId: string
    access: TeamAccess
    ctx: TeamContext
    gender: RadarGender
  }): Promise<Output> {
    try {
      const scope = { teamId: input.access.teamId, ctx: input.ctx }
      const result = await radarRepository.updateProfileGenderWithCtx(
        scope,
        input.profileId,
        input.gender
      )

      if (!result.updated) {
        return new Output(false, [], ["Perfil Radar não encontrado neste time"], null)
      }

      return new Output(
        true,
        ["Gênero do perfil atualizado"],
        [],
        {
          id: input.profileId,
          gender: input.gender,
          genderSource: "manual" as const,
        }
      )
    } catch (error) {
      console.error("[UpdateRadarProfileUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao atualizar perfil Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const updateRadarProfileUseCase = new UpdateRadarProfileUseCase()
