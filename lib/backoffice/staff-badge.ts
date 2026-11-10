export type StaffBadgeFunction = "SDR" | "CLOSER"

const STAFF_BADGE_LABELS: Record<StaffBadgeFunction, string> = {
  SDR: "SDR Backoffice",
  CLOSER: "Closer Backoffice",
}

/** Selos que o corretor vê no usuário da equipe Corretor Studio. */
export function getStaffBadgeLabels(functions: readonly StaffBadgeFunction[] | null | undefined): string[] {
  const labels = (["SDR", "CLOSER"] as const)
    .filter((fn) => functions?.includes(fn))
    .map((fn) => STAFF_BADGE_LABELS[fn])

  return labels.length > 0 ? labels : ["Backoffice"]
}
