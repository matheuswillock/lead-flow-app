import { Output } from "@/lib/output"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { publicFormsRepository } from "@/app/api/infra/data/repositories/publicForms/PublicFormsRepository"
import { radarRepository, type RadarTeamScope } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  buildRadarProfileFormItems,
  formIdFromRadarEventMetadata,
  type RadarProfileFormCatalogItem,
  type RadarProfileFormEventMarker,
} from "@/lib/radar/profile-forms"
import type { IListRadarProfileFormsUseCase } from "./IListRadarProfileFormsUseCase"

export type ListRadarProfileFormsDeps = {
  profileExistsInScope: (scope: RadarTeamScope, profileId: string) => Promise<boolean>
  listProfileFormEventMarkers: (
    scope: RadarTeamScope,
    profileId: string,
  ) => Promise<RadarProfileFormEventMarker[]>
  findFormsByIdsForTeam: (
    teamId: string,
    formIds: string[],
  ) => Promise<RadarProfileFormCatalogItem[]>
}

export class ListRadarProfileFormsUseCase implements IListRadarProfileFormsUseCase {
  constructor(private readonly deps: Partial<ListRadarProfileFormsDeps> = {}) {}

  private resolveDeps(): ListRadarProfileFormsDeps {
    return {
      profileExistsInScope:
        this.deps.profileExistsInScope ??
        radarRepository.profileExistsInScope.bind(radarRepository),
      listProfileFormEventMarkers:
        this.deps.listProfileFormEventMarkers ??
        (async (scope, profileId) => radarRepository.listProfileFormEventMarkers(scope, profileId)),
      findFormsByIdsForTeam:
        this.deps.findFormsByIdsForTeam ??
        (async (teamId, formIds) => publicFormsRepository.findFormsByIdsForTeam(teamId, formIds)),
    }
  }

  async execute(input: {
    teamId: string
    ctx: TeamContext
    profileId: string
  }): Promise<Output> {
    try {
      const deps = this.resolveDeps()
      const scope = { teamId: input.teamId, ctx: input.ctx }
      const exists = await deps.profileExistsInScope(scope, input.profileId)
      if (!exists) {
        return new Output(false, [], ["Perfil não encontrado"], null)
      }

      const events = await deps.listProfileFormEventMarkers(scope, input.profileId)
      const formIds = [
        ...new Set(
          events.flatMap((event) => {
            const formId = formIdFromRadarEventMetadata(event.metadata)
            return formId ? [formId] : []
          }),
        ),
      ]
      const forms = await deps.findFormsByIdsForTeam(input.teamId, formIds)
      const items = buildRadarProfileFormItems({ events, forms })
      return new Output(true, [], [], { items })
    } catch (error) {
      console.error("[ListRadarProfileFormsUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao listar formulários do perfil Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const listRadarProfileFormsUseCase = new ListRadarProfileFormsUseCase()
