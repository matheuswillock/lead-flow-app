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

/** Tipos emitidos por `processInBackground` — os únicos que nascem sem relógio. */
const SERVER_SIDE_EVENT_TYPES = [
  "form_completed",
  "lead_created",
  "lead_attached",
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
 * A submissão é encontrada pelo `visitorSessionId` do evento: o worker usa
 * `submission.visitorSessionId` quando existe e o `requestKey` como reserva —
 * as duas colunas são procuradas aqui pelo mesmo motivo.
 */
async function loadSubmissionsBySessionKey(
  sessionKeys: string[]
): Promise<Map<string, SubmissionAnchor>> {
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
    },
    orderBy: { createdAt: "asc" },
  })

  const bySessionKey = new Map<string, SubmissionAnchor>()
  for (const submission of submissions) {
    const anchor: SubmissionAnchor = {
      id: submission.id,
      requestKey: submission.requestKey,
      createdAt: submission.createdAt,
      dispatchAcceptedAt: submission.dispatchAcceptedAt,
    }
    // `orderBy asc` + `set` sem guarda deixaria a mais recente vencer; a
    // primeira submissão da sessão é a que originou o evento.
    if (submission.visitorSessionId && !bySessionKey.has(submission.visitorSessionId)) {
      bySessionKey.set(submission.visitorSessionId, anchor)
    }
    if (!bySessionKey.has(submission.requestKey)) {
      bySessionKey.set(submission.requestKey, anchor)
    }
  }
  return bySessionKey
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
    },
    orderBy: { createdAt: "asc" },
    ...(limit ? { take: limit } : {}),
  })

  if (clocklessEvents.length === 0) {
    console.info(`${LOG} Nenhum evento sem relógio. Nada a fazer.`)
    return
  }

  const submissionsBySessionKey = await loadSubmissionsBySessionKey([
    ...new Set(clocklessEvents.map((event) => event.visitorSessionId)),
  ])

  const candidates: ClocklessMetricEvent[] = clocklessEvents.map((event) => ({
    id: event.id,
    eventKey: event.eventKey,
    eventType: event.eventType,
    visitorSessionId: event.visitorSessionId,
    submission: submissionsBySessionKey.get(event.visitorSessionId) ?? null,
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

  for (const update of plan.updates) {
    await prisma.publicFormMetricEvent.update({
      where: { id: update.eventId },
      data: { occurredAt: update.occurredAt },
    })
    metricsUpdated += 1

    try {
      const result = await prisma.radarEvent.updateMany({
        where: {
          sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
          sourceId: update.eventKey,
        },
        data: { occurredAt: update.occurredAt },
      })
      radarUpdated += result.count
    } catch (error) {
      // Unique (teamId, sourceType, sourceId, eventType, occurredAt): já existe
      // linha na data certa. Reportar, não mascarar.
      radarConflicts += 1
      console.error(`${LOG} Conflito ao redatar evento do Radar`, {
        eventKey: update.eventKey,
        occurredAt: update.occurredAt.toISOString(),
        error,
      })
    }
  }

  console.info(`${LOG} Concluído`, { metricsUpdated, radarUpdated, radarConflicts })
}

main()
  .catch((error) => {
    console.error(`${LOG} Falhou`, error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
