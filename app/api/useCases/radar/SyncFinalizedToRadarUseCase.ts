import { Output } from "@/lib/output"
import {
  radarRepository,
  type RadarTeamScope,
} from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { normalizeRadarDocument } from "@/lib/radar/normalization"

/**
 * D14: sincroniza titulares e dependentes de `LeadFinalized` com o Radar.
 *
 * Regras de criação de perfil:
 * - Titular (`LeadFinalizedHolder`): sempre tem `document` (obrigatório no schema).
 *   Cria perfil com identidade `contract_holder` chaveada por `normalizedDocument`.
 * - Dependente (`LeadFinalizedDependent`): `document` é opcional.
 *   - Com `document`: cria perfil com identidade `contract_dependent`.
 *   - Sem `document`: NÃO cria perfil (sem chave natural confiável).
 *
 * Eventos gravados com `appendEventIfNew` para garantir idempotência:
 * - `profile.contract_linked` para o titular e para dependentes com documento.
 *
 * Gate `teamHasRadarFeature` é verificado pelo chamador via `syncFinalizedToRadarInline`.
 */
class SyncFinalizedToRadarUseCase {
  async execute(
    teamId: string,
    ctx: RadarTeamScope["ctx"],
    finalizedId: string
  ): Promise<Output> {
    try {
      const scope: RadarTeamScope = { teamId, ctx }

      const finalized = await radarRepository.findLeadFinalizedById(finalizedId)

      if (!finalized) {
        return new Output(false, [], ["LeadFinalized não encontrado"], null)
      }

      const { holder, dependents } = finalized

      if (holder) {
        const normalizedDoc = normalizeRadarDocument(holder.document)
        if (normalizedDoc) {
          const { profileId, created } = await radarRepository.upsertProfileForDocument({
            teamId: scope.teamId,
            identityType: "contract_holder",
            normalizedDocument: normalizedDoc,
            displayName: holder.name,
            lastSeenAt: holder.createdAt,
          })

          await radarRepository.appendEventIfNew({
            profileId,
            teamId: scope.teamId,
            eventType: "profile.contract_linked",
            sourceType: "contract",
            sourceId: `${finalizedId}::holder`,
            occurredAt: holder.createdAt,
            metadata: { finalizedId, role: "holder" },
          })

          void created
        }
      }

      for (let i = 0; i < dependents.length; i++) {
        const dep = dependents[i]
        const normalizedDoc = dep.document ? normalizeRadarDocument(dep.document) : ""
        if (!normalizedDoc) continue

        const { profileId, created } = await radarRepository.upsertProfileForDocument({
          teamId: scope.teamId,
          identityType: "contract_dependent",
          normalizedDocument: normalizedDoc,
          displayName: dep.name,
          lastSeenAt: dep.createdAt,
        })

        await radarRepository.appendEventIfNew({
          profileId,
          teamId: scope.teamId,
          eventType: "profile.contract_linked",
          sourceType: "contract",
          sourceId: `${finalizedId}::dep::${i}`,
          occurredAt: dep.createdAt,
          metadata: { finalizedId, role: "dependent", index: i },
        })

        void created
      }

      return new Output(true, [], [], { finalizedId })
    } catch (error) {
      console.error("[SyncFinalizedToRadarUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao sincronizar contrato com o Radar"
      return new Output(false, [], [message], null)
    }
  }
}

export const syncFinalizedToRadarUseCase = new SyncFinalizedToRadarUseCase()
