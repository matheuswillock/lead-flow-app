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
