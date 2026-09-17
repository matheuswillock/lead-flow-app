#!/usr/bin/env tsx
/**
 * Backfill: devolve o relógio do aceite aos eventos de conversão server-side
 * que nasceram com `occurredAt` NULL (SPEC 30 — DA3).
 *
 * Sintoma que isso corrige: conversão contada no dia em que a fila drenou, não
 * no dia em que o visitante enviou. O incidente de 20–22/08 destravou 105
 * submissões em 12 minutos e o funil de três dias passou a exibir mais
 * `form_completed` do que `form_viewed`.
 *
 * O que NÃO é corrigido: as cascas do dispatcher — submissões cujo `requestKey`
 * ainda começa com `progress:`, isto é, que nunca receberam envio e foram
 * completadas pela varredura do cron (SPEC 40 — E0). Datar essas linhas
 * inventaria uma conversão que não existiu. Elas ficam com `occurredAt` NULL e
 * saem do funil pelo caminho da própria SPEC 40.
 *
 * Além dos eventos de métrica, corrige o espelho no Radar (`RadarEvent` com
 * `sourceType='public_form'` e `sourceId` = `eventKey`), que herdou a mesma data
 * errada. A `@@unique(teamId, sourceType, sourceId, eventType, occurredAt)` pode
 * recusar a atualização quando já existe linha na data certa — o conflito é
 * contado e reportado, nunca engolido.
 *
 * Dry-run é o padrão. `--apply` grava no banco apontado por DATABASE_URL e só
 * deve rodar com autorização explícita do owner — nunca contra o remoto sem ela.
 *
 * Uso:
 *   bun run backfill:form-completed-occurred-at
 *   bun run backfill:form-completed-occurred-at -- --limit 50
 *   bun run backfill:form-completed-occurred-at -- --apply
 */

import { prisma } from "@/app/api/infra/data/prisma"
import {
  planFormCompletedOccurredAtBackfill,
  summarizeSkipReasons,
  type ClocklessMetricEvent,
  type SubmissionAnchor,
} from "@/lib/public-forms/backfill-form-completed-occurred-at"
import { PUBLIC_FORM_RADAR_SOURCE_TYPE } from "@/lib/radar/map-public-form-metric-to-radar-event"

const APPLY = process.argv.includes("--apply")
const LOG = "[backfill-form-completed-occurred-at]"

/**
 * Tipos emitidos por `processInBackground` — os únicos que nascem sem relógio.
 *
 * `lead_discarded` entra no mesmo lote e recebe o mesmo `occurredAt` do aceite.
 * Fora desta lista, o histórico dele ficaria no dia do drain enquanto os irmãos
 * do lote seriam corrigidos — funil e Radar de descarte dessincronizados do
 * resto da conversão.
 */
const SERVER_SIDE_EVENT_TYPES = [
  "form_completed",
  "lead_created",
  "lead_attached",
  "lead_discarded",
  "meeting_scheduled",
] as const

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function resolveLimit(): number | undefined {
  const raw = readFlag("limit")
  if (!raw) return undefined
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`${LOG} Erro: --limit inválido ("${raw}").`)
    process.exit(1)
  }
  return parsed
}

/**
 * TODAS as submissões de cada sessão, não uma por sessão.
 *
 * O worker identifica a sessão por `submission.visitorSessionId` e usa o
 * `requestKey` como reserva — as duas colunas entram na busca pelo mesmo motivo.
 * Guardar só a primeira colapsava sessões legítimas de 30 dias (campanhas
 * distintas) numa submissão só; `selectSubmissionForEvent` escolhe a certa.
 */
async function loadSubmissionCandidatesBySessionKey(
  sessionKeys: string[]
): Promise<Map<string, SubmissionAnchor[]>> {
  const submissions = await prisma.publicFormSubmission.findMany({
    where: {
      OR: [{ visitorSessionId: { in: sessionKeys } }, { requestKey: { in: sessionKeys } }],
    },
    select: {
      id: true,
      requestKey: true,
      visitorSessionId: true,
      createdAt: true,
      dispatchAcceptedAt: true,
      origin: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const bySessionKey = new Map<string, SubmissionAnchor[]>()
  const push = (key: string, anchor: SubmissionAnchor) => {
    const current = bySessionKey.get(key) ?? []
    if (!current.some((item) => item.id === anchor.id)) current.push(anchor)
    bySessionKey.set(key, current)
  }

  for (const submission of submissions) {
    const anchor: SubmissionAnchor = {
      id: submission.id,
      requestKey: submission.requestKey,
      createdAt: submission.createdAt,
      dispatchAcceptedAt: submission.dispatchAcceptedAt,
      emailLogId: readOriginEmailLogId(submission.origin),
    }
    if (submission.visitorSessionId) push(submission.visitorSessionId, anchor)
    push(submission.requestKey, anchor)
  }
  return bySessionKey
}

/** `<sessão>:<tipo>` ou `<sessão>:<tipo>:el:<emailLogId>` — ver `buildPublicFormMetricEventKey`. */
function parseAttributionFromEventKey(eventKey: string): string | null {
  const marker = ":el:"
  const index = eventKey.lastIndexOf(marker)
  if (index === -1) return null
  const emailLogId = eventKey.slice(index + marker.length)
  return emailLogId.length > 0 ? emailLogId : null
}

function readOriginEmailLogId(origin: unknown): string | null {
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return null
  const value = (origin as Record<string, unknown>).emailLogId
  return typeof value === "string" && value.length > 0 ? value : null
}

async function main() {
  const limit = resolveLimit()

  console.info(`${LOG} Iniciando`, {
    modo: APPLY ? "APPLY (grava no banco)" : "dry-run",
    limite: limit ?? "sem limite",
  })

  const clocklessEvents = await prisma.publicFormMetricEvent.findMany({
    where: {
      occurredAt: null,
      eventType: { in: [...SERVER_SIDE_EVENT_TYPES] },
    },
    select: {
      id: true,
      eventKey: true,
      eventType: true,
      visitorSessionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  })

  if (clocklessEvents.length === 0) {
    console.info(`${LOG} Nenhum evento sem relógio. Nada a fazer.`)
    return
  }

  const submissionsBySessionKey = await loadSubmissionCandidatesBySessionKey([
    ...new Set(clocklessEvents.map((event) => event.visitorSessionId)),
  ])

  const candidates: ClocklessMetricEvent[] = clocklessEvents.map((event) => ({
    id: event.id,
    eventKey: event.eventKey,
    eventType: event.eventType,
    visitorSessionId: event.visitorSessionId,
    createdAt: event.createdAt,
    attributionEmailLogId: parseAttributionFromEventKey(event.eventKey),
    submissionCandidates: submissionsBySessionKey.get(event.visitorSessionId) ?? [],
  }))

  const plan = planFormCompletedOccurredAtBackfill(candidates)

  console.info(`${LOG} Plano`, {
    eventosSemRelogio: clocklessEvents.length,
    aCorrigir: plan.updates.length,
    pulados: summarizeSkipReasons(plan.skipped),
  })

  for (const update of plan.updates.slice(0, 20)) {
    console.info("  ~", {
      eventKey: update.eventKey,
      occurredAt: update.occurredAt.toISOString(),
    })
  }
  if (plan.updates.length > 20) {
    console.info(`  … e mais ${plan.updates.length - 20} evento(s).`)
  }

  if (!APPLY) {
    console.info(`${LOG} Dry-run: nada foi gravado. Rode com --apply após autorização.`)
    return
  }

  let metricsUpdated = 0
  let radarUpdated = 0
  let radarConflicts = 0
  let failed = 0

  for (const update of plan.updates) {
    try {
      // As duas escritas numa transação: a métrica só recebe `occurredAt` se o
      // espelho do Radar também for redatado. Fora da transação, uma falha
      // transitória no Radar deixava a métrica corrigida e o Radar na data
      // errada — e, como a próxima execução só seleciona `occurredAt IS NULL`,
      // esse par nunca mais seria reprocessado.
      await prisma.$transaction(async (tx) => {
        await tx.publicFormMetricEvent.update({
          where: { id: update.eventId },
          data: { occurredAt: update.occurredAt },
        })

        // Conflito é DETECTADO antes, não capturado depois.
        //
        // No Postgres, um statement que falha aborta a transação inteira:
        // capturar o P2002 em JS não a restaura, o COMMIT falha mesmo assim, e o
        // conflito supostamente benigno derrubaria o par junto. Por isso a
        // duplicata é procurada com um SELECT — nenhum statement chega a errar.
        const alreadyAtTargetDate = await tx.radarEvent.findFirst({
          where: {
            sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
            sourceId: update.eventKey,
            occurredAt: update.occurredAt,
          },
          select: { id: true },
        })

        if (alreadyAtTargetDate) {
          radarConflicts += 1
          console.info(`${LOG} Evento do Radar já estava na data certa`, {
            eventKey: update.eventKey,
            occurredAt: update.occurredAt.toISOString(),
          })
          return
        }

        const result = await tx.radarEvent.updateMany({
          where: {
            sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
            sourceId: update.eventKey,
          },
          data: { occurredAt: update.occurredAt },
        })
        radarUpdated += result.count
      })
      metricsUpdated += 1
    } catch (error) {
      failed += 1
      console.error(`${LOG} Falha ao corrigir evento — segue retentável`, {
        eventKey: update.eventKey,
        occurredAt: update.occurredAt.toISOString(),
        error,
      })
    }
  }

  if (failed > 0) process.exitCode = 1

  console.info(`${LOG} Concluído`, { metricsUpdated, radarUpdated, radarConflicts, failed })
}

main()
  .catch((error) => {
    console.error(`${LOG} Falhou`, error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
