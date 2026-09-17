import type { PrismaClient } from "@prisma/client"

export type DispatchLogCounterRow = {
  dispatchId: string
  acceptedCount: number
  failedCount: number
  queuedCount: number
  /** Recusados pela pré-validação — terminais e não retentáveis. */
  suppressedCount: number
}

type QueryRawCapableClient = Pick<PrismaClient, "$queryRaw">

/**
 * Contadores de log por disparo, agregados no Postgres.
 *
 * Fonte única da definição de "aceito/falho/na fila/recusado" para um disparo:
 * a barra de progresso da campanha e a tabela de disparos do analytics leem daqui,
 * senão as duas telas contam a mesma população com regras diferentes.
 */
export async function queryDispatchLogCounters(
  db: QueryRawCapableClient,
  options: { teamId: string; dispatchIds: string[] }
): Promise<DispatchLogCounterRow[]> {
  if (options.dispatchIds.length === 0) return []

  const rows = await db.$queryRaw<
    Array<{
      dispatchId: string
      acceptedCount: number | bigint
      failedCount: number | bigint
      queuedCount: number | bigint
      suppressedCount: number | bigint
    }>
  >`
      SELECT
        "dispatchId",
        COUNT(*) FILTER (
          WHERE "sentAt" IS NOT NULL OR "resendEmailId" IS NOT NULL
        )::int AS "acceptedCount",
        COUNT(*) FILTER (
          WHERE status = 'failed'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "failedCount",
        COUNT(*) FILTER (
          WHERE status = 'queued'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "queuedCount",
        -- Recusados pela pré-validação, antes de tocar o provedor. Sem esta
        -- coluna eles não entram em contador nenhum e a barra de progresso fica
        -- travada abaixo de 100% num disparo que já terminou.
        COUNT(*) FILTER (
          WHERE status = 'suppressed'::"email_log_status"
            AND "sentAt" IS NULL
            AND "resendEmailId" IS NULL
        )::int AS "suppressedCount"
      FROM "corretor_studio_email_logs"
      WHERE "teamId" = ${options.teamId}::uuid
        AND "dispatchId" = ANY(${options.dispatchIds}::uuid[])
      GROUP BY "dispatchId"
    `

  return rows
    .filter((row) => Boolean(row.dispatchId))
    .map((row) => ({
      dispatchId: row.dispatchId,
      acceptedCount: Number(row.acceptedCount),
      failedCount: Number(row.failedCount),
      queuedCount: Number(row.queuedCount),
      suppressedCount: Number(row.suppressedCount),
    }))
}
