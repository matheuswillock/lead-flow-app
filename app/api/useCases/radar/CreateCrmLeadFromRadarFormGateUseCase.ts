import { Output } from "@/lib/output"
import type { IRadarLeadGateUnitOfWork } from "@/app/api/infra/data/repositories/radar/IRadarLeadGateUnitOfWork"
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

          const existingLeadId =
            matches.leadIdMatch ?? matches.phoneMatch ?? matches.emailMatch ?? null
          const promotion = await transaction.createOrUpdateFromRadarProfile({
            teamId: input.teamId,
            formId: input.formId,
            profile,
            existingLeadId,
            origin: input.origin ?? {},
          })
          await transaction.linkLeadIdentity({
            teamId: input.teamId,
            radarProfileId: profile.id,
            leadId: promotion.leadId,
            source: "public_form_radar_gate",
          })
          await transaction.appendGateEvent({
            teamId: input.teamId,
            radarProfileId: profile.id,
            eventType: promotion.created ? "radar.crm_lead_created" : "radar.crm_lead_attached",
            eventId: input.eventId,
            metadata: {
              leadId: promotion.leadId,
              created: promotion.created,
              formId: input.formId,
            },
          })
          await transaction.attachLeadToPendingSubmissions({
            formId: input.formId,
            visitorSessionId: input.visitorSessionId,
            leadId: promotion.leadId,
          })

          console.info("[CreateCrmLeadFromRadarFormGateUseCase][execute] lead materializado", {
            teamId: input.teamId,
            formId: input.formId,
            visitorSessionId: input.visitorSessionId,
            radarProfileId: profile.id,
            leadId: promotion.leadId,
            created: promotion.created,
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
}
