/**
 * Team-scoped public form templates.
 * Global templates (e.g. health_plan_simulator) have no allowlist entry.
 */

export const PUBLIC_FORM_TEMPLATE_IDS = {
  HEALTH_PLAN_SIMULATOR: "health_plan_simulator",
  PROFESSION_HEALTH_PLAN: "profession_health_plan",
} as const

export type PublicFormTemplateId =
  (typeof PUBLIC_FORM_TEMPLATE_IDS)[keyof typeof PUBLIC_FORM_TEMPLATE_IDS]

/** Kathrein Antunes — team "Kathrein Antunes" */
const KATHREIN_ANTUNES_TEAM_ID = "28f7b9e8-9516-4a08-864c-9ff3e085ba87"

const TEMPLATE_ALLOWED_TEAM_IDS: Partial<Record<PublicFormTemplateId, ReadonlySet<string>>> = {
  [PUBLIC_FORM_TEMPLATE_IDS.PROFESSION_HEALTH_PLAN]: new Set([KATHREIN_ANTUNES_TEAM_ID]),
}

export function isTeamAllowedForPublicFormTemplate(
  templateId: string | null | undefined,
  teamId?: string | null,
): boolean {
  if (!templateId) return false
  const allowed = TEMPLATE_ALLOWED_TEAM_IDS[templateId as PublicFormTemplateId]
  if (!allowed) return true
  if (!teamId) return false
  return allowed.has(teamId)
}

export function listVisiblePublicFormTemplates(teamId?: string | null): PublicFormTemplateId[] {
  return (Object.values(PUBLIC_FORM_TEMPLATE_IDS) as PublicFormTemplateId[]).filter((id) =>
    isTeamAllowedForPublicFormTemplate(id, teamId),
  )
}
