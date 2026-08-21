/**
 * Chaves int4 para `pg_try_advisory_lock(classid, objid)` a partir do UUID do
 * dispatch. Dois isolates não podem processar o mesmo `dispatchId` com
 * `maxConcurrency: 4` na fila principal.
 *
 * O lock é de **sessão**: acquire/unlock MUST usar a mesma conexão Postgres
 * (DIRECT_URL, sem PgBouncer transaction mode). `DATABASE_URL` `:6543` +
 * `pgbouncer=true` não sustenta lock de sessão entre statements.
 */
export function resolveDispatchLockConnectionString(
  env: NodeJS.Dict<string> = process.env
): string {
  const raw = env.DIRECT_URL || env.DATABASE_URL
  if (!raw) {
    throw new Error(
      "[dispatch-advisory-lock] DIRECT_URL ou DATABASE_URL é obrigatório para o lock de dispatch"
    )
  }
  const parsed = new URL(raw)
  parsed.searchParams.delete("pgbouncer")
  parsed.searchParams.delete("connection_limit")
  parsed.searchParams.delete("pool_timeout")
  return parsed.toString()
}

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
