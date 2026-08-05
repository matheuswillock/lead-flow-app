/**
 * Stable public form template slugs.
 * Visibility is resolved from `PublicFormTemplate` in the database
 * (`teamId` null = global / every team).
 */

export const PUBLIC_FORM_TEMPLATE_IDS = {
  HEALTH_PLAN_SIMULATOR: "health_plan_simulator",
  PROFESSION_HEALTH_PLAN: "profession_health_plan",
} as const

export type PublicFormTemplateId =
  (typeof PUBLIC_FORM_TEMPLATE_IDS)[keyof typeof PUBLIC_FORM_TEMPLATE_IDS]
