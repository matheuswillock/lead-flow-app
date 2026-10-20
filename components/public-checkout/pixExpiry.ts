export function isPixExpired(expirationDate: string | null | undefined, nowMs: number): boolean {
  if (!expirationDate) return false
  const expiresAtMs = Date.parse(expirationDate)
  return Number.isFinite(expiresAtMs) && nowMs >= expiresAtMs
}
