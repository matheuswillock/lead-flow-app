import type { PublicFormSubmissionContext } from "@/app/api/infra/data/repositories/publicForms/IPublicFormsRepository"
import {
  upsertLeadFromFormAnswers,
  type UpsertLeadOutcome,
} from "@/app/api/useCases/publicForms/publicFormLeadSync"
import type { PublicFormAnswerInput, PublicFormSnapshot } from "@/lib/public-forms/types"

export type LegacyPublicFormProgressLeadInput = {
  form: PublicFormSubmissionContext
  snapshot: PublicFormSnapshot
  answers: PublicFormAnswerInput[]
  visibleIds: Set<string>
  publicationId: string
  origin: Record<string, unknown>
  allowCreate: boolean
  /**
   * SPEC 40 — claim atômico do create de lead (bug de duplicatas do
   * `/progress`). Vem de `resolved.sessionSubmission.id`; ausente só na
   * primeiríssima requisição de uma sessão, quando a linha da submissão
   * ainda não existe para ser reivindicada.
   */
  submissionId?: string
}

export interface ILegacyPublicFormProgressLeadService {
  createOrUpdate(
    input: LegacyPublicFormProgressLeadInput,
  ): Promise<UpsertLeadOutcome>
}

export class LegacyPublicFormProgressLeadService
  implements ILegacyPublicFormProgressLeadService
{
  createOrUpdate(
    input: LegacyPublicFormProgressLeadInput,
  ): Promise<UpsertLeadOutcome> {
    return upsertLeadFromFormAnswers(input)
  }
}

export const legacyPublicFormProgressLeadService = new LegacyPublicFormProgressLeadService()
