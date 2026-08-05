import type { PublicFormDraftInput } from "../types"
import { createProfessionHealthPlanDraft } from "./profession-health-plan"

/**
 * Seed source for the global `basic_form` template ("Formulário básico").
 * Content mirrors the Kathrein `profession_health_plan` draft; runtime loads
 * the snapshot from `PublicFormTemplate` in the database.
 */
export function createBasicFormDraft(): PublicFormDraftInput {
  return createProfessionHealthPlanDraft()
}
