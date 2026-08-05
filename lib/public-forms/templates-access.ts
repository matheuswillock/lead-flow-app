/**
 * Stable public form template slugs.
 * Visibility is resolved from `PublicFormTemplate` in the database:
 * only global templates (`teamId` null) with `isActive = true` appear in the product catalog.
 */

export const PUBLIC_FORM_TEMPLATE_IDS = {
  HEALTH_PLAN_SIMULATOR: "health_plan_simulator",
  BASIC_FORM: "basic_form",
} as const

export type PublicFormTemplateId =
  (typeof PUBLIC_FORM_TEMPLATE_IDS)[keyof typeof PUBLIC_FORM_TEMPLATE_IDS]
