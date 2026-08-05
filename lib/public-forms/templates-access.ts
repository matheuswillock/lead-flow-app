/**
 * Stable public form template slugs.
 * Visibility is resolved from `PublicFormTemplate` in the database:
 * - `teamId` null = global (every team)
 * - `teamId` set = exclusive to that team (e.g. profession_health_plan → Kathrein)
 *
 * Dual model for "Formulário básico":
 * - `basic_form` — global copy available to all teams
 * - `profession_health_plan` — Kathrein team-scoped instance (WhatsApp CTA)
 */

export const PUBLIC_FORM_TEMPLATE_IDS = {
  HEALTH_PLAN_SIMULATOR: "health_plan_simulator",
  BASIC_FORM: "basic_form",
  PROFESSION_HEALTH_PLAN: "profession_health_plan",
} as const

export type PublicFormTemplateId =
  (typeof PUBLIC_FORM_TEMPLATE_IDS)[keyof typeof PUBLIC_FORM_TEMPLATE_IDS]
