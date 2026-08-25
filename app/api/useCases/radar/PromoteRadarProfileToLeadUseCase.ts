import { Output } from "@/lib/output"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { leadUseCase } from "@/app/api/useCases/leads/leadUseCaseFactory"
import { syncLeadToRadarUseCase } from "@/app/api/useCases/radar/SyncLeadToRadarUseCase"
import type { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead"
import { isPendingLeadIdentity } from "@/lib/radar/lead-identity"

type PromotionProfile = NonNullable<
  Awaited<ReturnType<typeof radarRepository.getProfileForPromotionWithCtx>>
>

/**
 * Vínculo REAL com o CRM — reserva provisória não conta.
 *
 * Este gate roda ANTES de `claimProvisionalLeadIdentity`. Tratar a reserva
 * `pending:` como vínculo faria o perfil responder "já está vinculado a um
 * Lead" para sempre quando a liberação falhasse, e a retomada de reserva órfã
 * que existe na claim nunca seria alcançada — código morto.
 */
function profileHasLeadIdentity(profile: PromotionProfile): boolean {
  return profile.identities.some(
    (identity) =>
      identity.type === "lead_id" && !isPendingLeadIdentity(identity.normalizedValue)
  )
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
    /**
     * Confirmação explícita do usuário de que quer criar o Lead mesmo havendo
     * candidato a duplicata. Sem ela, o conflito volta como fluxo (409 com os
     * candidatos no `result`), não como erro seco.
     */
    confirmDuplicate?: boolean
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

      // Reserva o slot ANTES de criar o Lead. Criar primeiro e reservar depois
      // era o que obrigava, ao perder a corrida com o sync inline, a DELETAR o
      // Lead recém-criado (R5/H3). Agora o rollback apaga só a linha
      // provisória, que ninguém referencia.
      const claim = await radarRepository.claimProvisionalLeadIdentity(
        input.access.teamId,
        profile.id
      )

      if (!claim) {
        return new Output(
          false,
          [],
          ["Este perfil Radar já foi promovido a Lead por outra operação"],
          null
        )
      }

      const phone = resolvePromotionPhone(profile)
      const email = resolvePromotionEmail(profile)

      let createOutput: Output
      try {
        createOutput = await leadUseCase.createLead(
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
            ...(input.confirmDuplicate === true ? { confirmDuplicate: true } : {}),
          } as unknown as CreateLeadRequest,
          input.access.teamId
        )
      } catch (createError) {
        await this.releaseClaim(input.access.teamId, claim.identityId)
        throw createError
      }

      const createdLead = createOutput.result as { id?: string } | null

      if (!createOutput.isValid || !createdLead?.id) {
        await this.releaseClaim(input.access.teamId, claim.identityId)

        // O `result` do LeadUseCase carrega `requiresDuplicateConfirmation` +
        // `duplicateCandidates`. Repassar íntegro é o que deixa a rota devolver
        // 409 e o frontend oferecer "criar assim mesmo" ([[11]] E1). Antes o
        // Output voltava com `result` que a rota tratava como 400 genérico.
        if (!createOutput.isValid) {
          return createOutput
        }
        return new Output(false, [], ["Erro ao criar Lead a partir do perfil Radar"], null)
      }

      let identityLinked = true
      try {
        await radarRepository.finalizeLeadIdentityClaim(
          input.access.teamId,
          claim.identityId,
          createdLead.id
        )
      } catch (finalizeError) {
        identityLinked = false
        // O Lead JÁ EXISTE neste ponto. Deixar a reserva para trás bloquearia o
        // perfil (o gate acima e a própria claim veem qualquer `lead_id`), e o
        // usuário ficaria com um Lead criado que ele não consegue revincular.
        // Libera a reserva e delega o vínculo ao sync logo abaixo — que é o
        // mesmo caminho pelo qual todo lead se liga a um perfil normalmente.
        console.error(
          "[PromoteRadarProfileToLeadUseCase][execute] Falha ao finalizar reserva; liberando e delegando ao sync:",
          finalizeError
        )
        await this.releaseClaim(input.access.teamId, claim.identityId)
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

      // O vínculo existe se a finalização OU o sync deu certo. Falhando os
      // dois, o Lead está criado e SOLTO — dizer "vinculado ao perfil Radar"
      // aqui seria mentira, e é o tipo de mentira que some: o usuário fecha o
      // dialog achando que acabou.
      if (!identityLinked && !syncOutput.isValid) {
        console.error(
          `[PromoteRadarProfileToLeadUseCase][execute] Lead ${createdLead.id} criado sem vínculo com o perfil ${profile.id}`
        )
        // `isValid` segue true de propósito: o Lead EXISTE. Reportar falha faria
        // o usuário tentar de novo e criar um segundo Lead — pior que o vínculo
        // faltando, que o próximo sync do CRM resolve.
        return new Output(
          true,
          ["Lead criado, mas o vínculo com o perfil Radar não foi confirmado."],
          [],
          { leadId: createdLead.id, radarProfileId: profile.id, identityLinked: false }
        )
      }

      return new Output(
        true,
        ["Lead criado e vinculado ao perfil Radar"],
        [],
        { leadId: createdLead.id, radarProfileId: profile.id, identityLinked: true }
      )
    } catch (error) {
      console.error("[PromoteRadarProfileToLeadUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao promover perfil Radar a Lead"
      return new Output(false, [], [message], null)
    }
  }

  /**
   * Devolve o slot reservado quando o Lead não chegou a existir.
   *
   * Best-effort de propósito: se a liberação falhar, o perfil fica com uma
   * identidade `pending:` que bloqueia nova promoção — ruim, mas recuperável
   * (é uma linha marcada com `source = manual_promote_pending`). Propagar o
   * erro aqui esconderia a causa real da falha do usuário.
   */
  private async releaseClaim(teamId: string, identityId: string): Promise<void> {
    try {
      await radarRepository.releaseLeadIdentityClaim(teamId, identityId)
    } catch (releaseError) {
      console.error(
        "[PromoteRadarProfileToLeadUseCase][releaseClaim] Falha ao liberar reserva de lead_id:",
        releaseError
      )
    }
  }
}

export const promoteRadarProfileToLeadUseCase = new PromoteRadarProfileToLeadUseCase()
