import type { PublicFormDraftInput } from "../types"
import { createProfessionHealthPlanDraft } from "./profession-health-plan"

/**
 * Seed source for the global `basic_form` template ("Formulário básico").
 * Content mirrors the Kathrein `profession_health_plan` draft without her
 * WhatsApp CTA (global teams must not inherit that number). Runtime loads
 * the snapshot from `PublicFormTemplate` in the database.
 */
export function createBasicFormDraft(): PublicFormDraftInput {
  const draft = createProfessionHealthPlanDraft()
  const thankYouPages = (draft.thankYouPages ?? []).map((page) => ({
    ...page,
    actions: [],
  }))

  return {
    ...draft,
    successActions: [],
    thankYouPages,
  }
}
