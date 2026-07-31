export function validateTeamEmailLimitMaxPerDay(value: number | null | undefined): string | null {
  if (value == null) return null
  if (!Number.isInteger(value) || value < 1) {
    return "Informe um limite diário válido (mínimo 1) ou marque como sem limite"
  }
  return null
}
