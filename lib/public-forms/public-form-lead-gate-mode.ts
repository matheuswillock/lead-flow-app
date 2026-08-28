export type PublicFormLeadGateMode = "legacy" | "shadow" | "radar"
type PublicFormLeadGateEnvironment = {
  PUBLIC_FORM_LEAD_GATE_MODE?: string
  PUBLIC_FORM_RADAR_CANARY_TEAM_IDS?: string
}

const DEFAULT_PUBLIC_FORM_LEAD_GATE_MODE: PublicFormLeadGateMode = "legacy"

function parsePublicFormLeadGateMode(value: string | undefined): PublicFormLeadGateMode {
  if (value === "legacy" || value === "shadow" || value === "radar") return value
  return DEFAULT_PUBLIC_FORM_LEAD_GATE_MODE
}

function parseCanaryTeamIds(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((teamId) => teamId.trim())
      .filter(Boolean),
  )
}

export function resolvePublicFormLeadGateMode(
  teamId: string,
  environment: PublicFormLeadGateEnvironment = {
    PUBLIC_FORM_LEAD_GATE_MODE: process.env.PUBLIC_FORM_LEAD_GATE_MODE,
    PUBLIC_FORM_RADAR_CANARY_TEAM_IDS: process.env.PUBLIC_FORM_RADAR_CANARY_TEAM_IDS,
  },
): PublicFormLeadGateMode {
  const canaryTeamIds = parseCanaryTeamIds(environment.PUBLIC_FORM_RADAR_CANARY_TEAM_IDS)
  if (canaryTeamIds.has(teamId)) return "radar"
  return parsePublicFormLeadGateMode(environment.PUBLIC_FORM_LEAD_GATE_MODE)
}
