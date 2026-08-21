/**
 * Chaves int4 para `pg_try_advisory_lock(classid, objid)` a partir do UUID do
 * dispatch. Dois isolates não podem processar o mesmo `dispatchId` com
 * `maxConcurrency: 4` na fila principal.
 */
export function toDispatchAdvisoryLockKeys(dispatchId: string): [number, number] {
  const hex = dispatchId.replaceAll("-", "").slice(0, 16)
  const classid = Number.parseInt(hex.slice(0, 8), 16)
  const objid = Number.parseInt(hex.slice(8, 16), 16)
  if (!Number.isFinite(classid) || !Number.isFinite(objid)) {
    return [0, 0]
  }
  return [classid | 0, objid | 0]
}

export function isPgAdvisoryLockAcquired(value: unknown): boolean {
  return value === true || value === "t" || value === "true"
}
