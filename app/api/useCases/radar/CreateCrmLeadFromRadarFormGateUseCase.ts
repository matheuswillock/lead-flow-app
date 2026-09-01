import { Output } from "@/lib/output"
import type {
  IRadarLeadGateUnitOfWork,
  RadarLeadGateProfile,
  RadarLeadGateReferral,
  RadarLeadGateTransaction,
  RadarSubmittedIdentity,
} from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"
import { isTypedIdentityDivergentFromLead } from "@/lib/radar/typed-identity-divergence"
import { EvaluateRadarProfileLeadEligibilityUseCase } from "./EvaluateRadarProfileLeadEligibilityUseCase"

export type CreateCrmLeadFromRadarFormGateInput = {
  teamId: string
  formId: string
  visitorSessionId: string
  radarProfileId: string
  eventId: string
  origin?: Record<string, unknown>
}

export class CreateCrmLeadFromRadarFormGateUseCase {
  constructor(
    private readonly unitOfWork: IRadarLeadGateUnitOfWork,
    private readonly eligibilityUseCase: EvaluateRadarProfileLeadEligibilityUseCase,
  ) {}

  async execute(input: CreateCrmLeadFromRadarFormGateInput): Promise<Output> {
    try {
      return await this.unitOfWork.execute(
        { teamId: input.teamId, radarProfileId: input.radarProfileId },
        async (transaction) => {
          const profile = await transaction.reloadProfile(input.teamId, input.radarProfileId)
          if (!profile) {
            return new Output(true, [], [], { skipped: "profile_not_found" })
          }

          const eligibility = this.eligibilityUseCase.evaluateProfile(profile)
          if (!eligibility.eligible) {
            // E2/DA2: aqui NÃO nasce evento de descarte, e é de propósito.
            //
            // Este gate roda a cada `question_answered` que muda identidade —
            // digitar o nome antes do telefone passa por aqui como
            // `invalid_phone` e o telefone chega no evento seguinte. Emitir
            // deixaria um descarte para sessão que converte, o mesmo motivo que
            // manteve o `/progress` fora da emissão. O descarte do modo radar
            // sai no completamento (`processInBackground`, quando não há lead
            // resolvido), que é terminal e é onde o par do funil é medido.
            return new Output(true, [], [], {
              skipped: "not_eligible",
              reason: eligibility.reason,
            })
          }

          const matches = await transaction.findIdentityMatches(profile)
          const distinctLeadIds = new Set(
            [matches.leadIdMatch, matches.phoneMatch, matches.emailMatch].filter(
              (leadId): leadId is string => Boolean(leadId),
            ),
          )
          if (distinctLeadIds.size > 1) {
            await transaction.appendGateEvent({
              teamId: input.teamId,
              radarProfileId: profile.id,
              eventType: "radar.crm_identity_conflict",
              eventId: input.eventId,
              metadata: {
                leadIdMatch: matches.leadIdMatch,
                phoneMatch: matches.phoneMatch,
                emailMatch: matches.emailMatch,
              },
            })
            return new Output(true, [], [], {
              skipped: "identity_conflict",
              eligible: true,
            })
          }

          const candidateLeadId =
            matches.leadIdMatch ?? matches.phoneMatch ?? matches.emailMatch ?? null
          const placement = await this.resolveSessionPlacement({
            transaction,
            teamId: input.teamId,
            formId: input.formId,
            visitorSessionId: input.visitorSessionId,
            radarProfileId: profile.id,
            candidateLeadId,
          })
          const divergence = placement.divergentFromLeadId

          const promotion = await transaction.createOrUpdateFromRadarProfile({
            teamId: input.teamId,
            formId: input.formId,
            profile:
              divergence && placement.typed
                ? overlayTypedIdentityOnProfile(profile, placement.typed)
                : profile,
            existingLeadId: divergence ? placement.sessionReferralLeadId : candidateLeadId,
            origin: input.origin ?? {},
            referral: divergence
              ? buildReferral({
                  leadId: divergence,
                  radarProfileId: profile.id,
                  origin: input.origin ?? {},
                })
              : null,
            // Semente pela SUBMISSÃO, não pela sessão: o cookie de sessão dura
            // 30 dias e o mesmo formulário aceita uma segunda conversão (outra
            // campanha) dentro dela. Semeando pela sessão, duas indicações
            // divergentes derivariam o mesmo `leadCode` — `@unique` global — e a
            // segunda morreria em P2002, deixando o respondente sem card.
            leadCodeSeed: divergence ? (placement.typed?.submissionId ?? null) : null,
          })

          // Divergência = o perfil do Radar continua sendo o do DESTINATÁRIO do
          // e-mail, e o vínculo dele segue com o lead original. Revincular aqui
          // apontaria o perfil do destinatário para o card de quem respondeu o
          // encaminhamento — e `linkLeadIdentity` recusaria de qualquer forma
          // ("Perfil Radar já está vinculado a outro lead"), derrubando a
          // transação inteira. O lead novo nasce sem vínculo de perfil; quem o
          // ganha é o perfil do próprio respondente quando ele aparecer pela
          // identidade digitada. A âncora de idempotência do gate é o
          // `leadId` da submissão da sessão, não o vínculo do perfil.
          if (!divergence) {
            await transaction.linkLeadIdentity({
              teamId: input.teamId,
              radarProfileId: profile.id,
              leadId: promotion.leadId,
              source: "public_form_radar_gate",
            })
          }
          await transaction.appendGateEvent({
            teamId: input.teamId,
            radarProfileId: profile.id,
            eventType: promotion.created ? "radar.crm_lead_created" : "radar.crm_lead_attached",
            eventId: input.eventId,
            metadata: {
              leadId: promotion.leadId,
              created: promotion.created,
              formId: input.formId,
              ...(divergence
                ? {
                    typedIdentityDivergence: true,
                    referralOfLeadId: divergence,
                  }
                : {}),
            },
          })
          await transaction.attachLeadToPendingSubmissions({
            formId: input.formId,
            visitorSessionId: input.visitorSessionId,
            leadId: promotion.leadId,
            // Duas direções, o mesmo princípio: a submissão corrente pertence
            // ao lead que o gate acabou de resolver.
            //
            // Divergência — a sessão pode ter sido anexada ao lead do
            // destinatário numa resposta anterior, quando a identidade digitada
            // ainda estava incompleta; sem puxá-la, a conclusão fica no card
            // errado e a revisão seguinte cria mais um lead de indicação.
            //
            // Sem divergência — o respondente pode ter CORRIGIDO a identidade
            // para a do destinatário depois de já ter ganhado um card de
            // indicação; aí a submissão volta. Só um card de indicação **deste
            // gate para este perfil** é remanejado: lead que a sessão ganhou por
            // outro fluxo não é nosso para mover.
            replaceLeadId: divergence ? candidateLeadId : placement.sessionReferralLeadId,
            submissionId: placement.typed?.submissionId ?? null,
          })

          console.info("[CreateCrmLeadFromRadarFormGateUseCase][execute] lead materializado", {
            teamId: input.teamId,
            formId: input.formId,
            visitorSessionId: input.visitorSessionId,
            radarProfileId: profile.id,
            leadId: promotion.leadId,
            created: promotion.created,
            typedIdentityDivergence: Boolean(divergence),
          })
          return new Output(true, [], [], promotion)
        },
      )
    } catch (error) {
      console.error("[CreateCrmLeadFromRadarFormGateUseCase][execute]", error)
      const message =
        error instanceof Error ? error.message : "Erro ao criar lead CRM a partir do Radar"
      return new Output(false, [], [message], null)
    }
  }

  /**
   * Onde a submissão desta sessão pertence.
   *
   * O gate ancora no perfil do destinatário do e-mail — quem responde um
   * encaminhamento é outra pessoa. Quando telefone **e** e-mail digitados
   * divergem do lead candidato, a resposta merece card próprio; era esse anexo
   * mudo que fazia o prospect real desaparecer dentro do card do destinatário.
   *
   * `sessionReferralLeadId` é o card de indicação que **este gate** já criou
   * para **este perfil** nesta sessão. Serve de âncora de idempotência na
   * divergência (sem ele, cada campo digitado criaria um card) e de destino de
   * volta quando o respondente corrige a identidade. Lead que a sessão ganhou
   * por outro fluxo nunca entra aqui.
   */
  private async resolveSessionPlacement(input: {
    transaction: RadarLeadGateTransaction
    teamId: string
    formId: string
    visitorSessionId: string
    radarProfileId: string
    candidateLeadId: string | null
  }): Promise<{
    typed: RadarSubmittedIdentity | null
    divergentFromLeadId: string | null
    sessionReferralLeadId: string | null
  }> {
    const empty = { typed: null, divergentFromLeadId: null, sessionReferralLeadId: null }
    const candidateLeadId = input.candidateLeadId
    if (!candidateLeadId) return empty

    const typed = await input.transaction.findSubmittedIdentity({
      formId: input.formId,
      visitorSessionId: input.visitorSessionId,
    })
    if (!typed) return empty

    const sessionReferralLeadId = await this.resolveSessionReferralLead({
      transaction: input.transaction,
      teamId: input.teamId,
      radarProfileId: input.radarProfileId,
      sessionLeadId: typed.sessionLeadId,
      candidateLeadId,
    })

    const candidateIdentity = await input.transaction.findLeadIdentity({
      teamId: input.teamId,
      leadId: candidateLeadId,
    })
    const divergent = isTypedIdentityDivergentFromLead(typed, candidateIdentity)

    return {
      typed,
      divergentFromLeadId: divergent ? candidateLeadId : null,
      sessionReferralLeadId,
    }
  }

  private async resolveSessionReferralLead(input: {
    transaction: RadarLeadGateTransaction
    teamId: string
    radarProfileId: string
    sessionLeadId: string | null
    candidateLeadId: string
  }): Promise<string | null> {
    const { sessionLeadId } = input
    if (!sessionLeadId || sessionLeadId === input.candidateLeadId) return null

    const sessionLead = await input.transaction.findLeadIdentity({
      teamId: input.teamId,
      leadId: sessionLeadId,
    })
    return sessionLead?.referralOfRadarProfileId === input.radarProfileId ? sessionLeadId : null
  }
}

/**
 * O lead novo nasce com a identidade DIGITADA, não com o que o perfil do
 * destinatário carrega. Campo digitado ausente cai de volta no perfil.
 */
function overlayTypedIdentityOnProfile(
  profile: RadarLeadGateProfile,
  typed: RadarSubmittedIdentity,
): RadarLeadGateProfile {
  const name = typed.name?.trim() || profile.displayName
  const phone = typed.phone?.trim() || profile.displayPhone
  const email = typed.email?.trim().toLowerCase() || profile.primaryEmail
  return {
    ...profile,
    displayName: name,
    displayPhone: phone,
    normalizedPhone: typed.phone?.trim() ? null : profile.normalizedPhone,
    primaryEmail: email,
    normalizedPrimaryEmail: typed.email?.trim() ? email : profile.normalizedPrimaryEmail,
  }
}

/**
 * Encaminhamento é informação comercial, não ruído: fica no `originMetadata`
 * do lead novo (campo JSON existente — sem migration) com o lead e o perfil de
 * origem, para o time saber de quem veio a indicação.
 */
function buildReferral(input: {
  leadId: string
  radarProfileId: string
  origin: Record<string, unknown>
}): RadarLeadGateReferral {
  const emailLogId = typeof input.origin.emailLogId === "string" ? input.origin.emailLogId : null
  const campaignId = typeof input.origin.campaignId === "string" ? input.origin.campaignId : null
  return {
    reason: "typed_identity_divergence",
    referralOfLeadId: input.leadId,
    referralOfRadarProfileId: input.radarProfileId,
    referralOfEmailLogId: emailLogId,
    referralOfCampaignId: campaignId,
  }
}
