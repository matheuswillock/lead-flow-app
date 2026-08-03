export const CORRETOR_STUDIO_CREATOR_LABEL = "Corretor Studio"

export type EmailCreatorRef = {
  fullName?: string | null
  email?: string | null
}

export function formatEmailCreatorLabel(item: {
  creator?: EmailCreatorRef | null
  managedByCorretorStudio?: boolean
}): string {
  if (item.managedByCorretorStudio) return CORRETOR_STUDIO_CREATOR_LABEL
  return item.creator?.fullName?.trim() || item.creator?.email || "—"
}

export function resolveEmailCreator<T extends { creator?: unknown; managedByCorretorStudio?: boolean }>(
  row: T
): T {
  if (!row.managedByCorretorStudio) return row
  return {
    ...row,
    creator: { fullName: CORRETOR_STUDIO_CREATOR_LABEL, email: null },
  }
}
