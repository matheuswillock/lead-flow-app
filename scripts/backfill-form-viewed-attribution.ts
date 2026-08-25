#!/usr/bin/env tsx
/**
 * Backfill: recupera a atribuição de campanha das linhas de métrica perdidas
 * pelo bug do `eventKey` (corrigido em 2026-08-24).
 *
 * Sintoma que isso corrige: campanhas exibindo `Form. Visualizado = 0` com
 * `Form. Iniciado` e `Form. Finalizado` maiores que zero — funil logicamente
 * impossível. Ver `lib/public-forms/backfill-form-viewed-attribution.ts` para a
 * causa-raiz e o porquê de sintetizar a linha em vez de mutar a órfã.
 *
 * `--event-type` escolhe o alvo. Os dois sofrem a mesma colisão de chave, mas
 * a regra de doador difere por semântica, não por preferência — ver
 * `DONOR_TYPES_BY_TARGET` na lib:
 *   form_viewed  (padrão) — qualquer evento atribuído prova visualização
 *   form_started           — só conclusão prova início
 *
 * O script NÃO altera nenhuma linha existente: só insere as que o upsert
 * first-write-wins impediu de nascer. Cada linha criada leva
 * `origin.backfill` com o marcador do alvo, então a reversão é um `deleteMany`
 * por esse campo.
 *
 * Dry-run é o padrão. `--apply` grava no banco apontado por DATABASE_URL e só
 * deve rodar com autorização explícita do owner — nunca contra o remoto sem ele.
 *
 * Uso:
 *   bun run backfill:form-viewed-attribution
 *   bun run backfill:form-viewed-attribution -- --event-type form_started
 *   bun run backfill:form-viewed-attribution -- --team-id <uuid>
 *   bun run backfill:form-viewed-attribution -- --since 2026-06-01 --apply
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  applyEmailLogAttribution,
  BACKFILL_MARKER_BY_TARGET,
  collectUnattributedEmailLogIds,
  planFormViewedAttributionBackfill,
  type BackfillTarget,
  type EmailLogAttribution,
  type MetricEventRow,
} from "@/lib/public-forms/backfill-form-viewed-attribution"

const APPLY = process.argv.includes("--apply")
const DEFAULT_WINDOW_DAYS = 90
const SESSION_CHUNK = 500

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

function resolveTarget(): BackfillTarget {
  const raw = readFlag("event-type")?.trim()
  if (!raw || raw === "form_viewed") return "form_viewed"
  if (raw === "form_started") return "form_started"
  console.error(`Erro: --event-type inválido ("${raw}"). Use form_viewed ou form_started.`)
  process.exit(1)
}

function resolveSince(): Date {
  const raw = readFlag("since")
  if (!raw) {
    const fallback = new Date()
    fallback.setDate(fallback.getDate() - DEFAULT_WINDOW_DAYS)
    return fallback
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    console.error(`Erro: --since inválido ("${raw}"). Use YYYY-MM-DD.`)
    process.exit(1)
  }
  return parsed
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function hasEmailLogId(origin: unknown): boolean {
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return false
  return typeof (origin as Record<string, unknown>).emailLogId === "string"
}

async function resolveFormIds(teamId: string | null): Promise<string[] | null> {
  if (!teamId) return null
  const forms = await prisma.publicForm.findMany({
    where: { teamId },
    select: { id: true },
  })
  if (forms.length === 0) {
    console.error(`Erro: nenhum formulário público para o time ${teamId}.`)
    process.exit(1)
  }
  return forms.map((form) => form.id)
}

async function main() {
  const since = resolveSince()
  const teamId = readFlag("team-id")
  const target = resolveTarget()
  const formIds = await resolveFormIds(teamId)

  console.info("[backfill-form-viewed-attribution] Iniciando", {
    modo: APPLY ? "APPLY (grava no banco)" : "dry-run",
    alvo: target,
    desde: since.toISOString(),
    escopo: teamId ? `time ${teamId} (${formIds?.length} formulário(s))` : "todos os times",
  })

  // 1. Sessões com o evento alvo sem atribuição — as candidatas.
  const orphanViews = await prisma.publicFormMetricEvent.findMany({
    where: {
      eventType: target,
      createdAt: { gte: since },
      ...(formIds ? { formId: { in: formIds } } : {}),
    },
    select: { visitorSessionId: true, origin: true },
  })

  const candidateSessions = [
    ...new Set(
      orphanViews
        .filter((row) => !hasEmailLogId(row.origin))
        .map((row) => row.visitorSessionId)
    ),
  ]

  console.info("[backfill-form-viewed-attribution] Candidatas", {
    eventosNoPeriodo: orphanViews.length,
    sessoesComEventoSemAtribuicao: candidateSessions.length,
  })

  if (candidateSessions.length === 0) {
    console.info("[backfill-form-viewed-attribution] Nada a fazer.")
    return
  }

  // 2. Todas as linhas dessas sessões — o doador pode ser de qualquer tipo.
  const rows: MetricEventRow[] = []
  for (const sessions of chunk(candidateSessions, SESSION_CHUNK)) {
    const batch = await prisma.publicFormMetricEvent.findMany({
      where: { visitorSessionId: { in: sessions } },
      select: {
        eventKey: true,
        eventType: true,
        visitorSessionId: true,
        formId: true,
        publicationId: true,
        occurredAt: true,
        createdAt: true,
        origin: true,
      },
    })
    rows.push(...batch)
  }

  const plan = planFormViewedAttributionBackfill(rows, target)

  // 3. Doadores como `question_viewed` carregam `emailLogId` (veio do cs_el na
  // URL) mas não `campaignId` — só os três eventos de funil passam pelo
  // enriquecimento do servidor. Resolver aqui, senão a linha nasce inerte:
  // o analytics filtra exatamente por `origin.campaignId`.
  const pendingEmailLogIds = collectUnattributedEmailLogIds(plan.rows)
  const attributionByEmailLogId = new Map<string, EmailLogAttribution>()

  for (const ids of chunk(pendingEmailLogIds, SESSION_CHUNK)) {
    const logs = await prisma.emailLog.findMany({
      where: { id: { in: ids }, category: "campaign" },
      select: { id: true, campaignId: true, dispatchId: true, recipientEmail: true },
    })
    for (const log of logs) {
      attributionByEmailLogId.set(log.id, {
        campaignId: log.campaignId,
        dispatchId: log.dispatchId,
        recipientEmail: log.recipientEmail,
      })
    }
  }

  const { rows: plannedRows, droppedEmailLogIds } = applyEmailLogAttribution(
    plan.rows,
    attributionByEmailLogId
  )

  console.info("[backfill-form-viewed-attribution] Plano", {
    linhasASintetizar: plannedRows.length,
    campaignIdResolvidoViaEmailLog: pendingEmailLogIds.length - droppedEmailLogIds.length,
    descartadasSemCampanha: droppedEmailLogIds.length,
    sessoesJaAtribuidas: new Set(plan.sessionsAlreadyAttributed).size,
    sessoesSemViewOrfa: new Set(plan.sessionsWithoutOrphanView).size,
  })

  for (const item of plannedRows.slice(0, 20)) {
    console.info("  +", {
      eventKey: item.eventKey,
      doador: `${item.donorEventType} (${item.donorEventKey})`,
      campaignId: item.origin.campaignId,
      createdAt: item.createdAt.toISOString(),
    })
  }
  if (plannedRows.length > 20) {
    console.info(`  … e mais ${plannedRows.length - 20} linha(s)`)
  }

  if (droppedEmailLogIds.length > 0) {
    console.info(
      "[backfill-form-viewed-attribution] Aviso: emailLogId sem EmailLog de campanha correspondente — linhas descartadas",
      { total: droppedEmailLogIds.length, exemplos: droppedEmailLogIds.slice(0, 5) }
    )
  }

  if (plan.sessionsWithoutOrphanView.length > 0) {
    console.info(
      "[backfill-form-viewed-attribution] Aviso: sessões com evento atribuído mas sem nenhum evento alvo órfão — não sintetizadas por precaução",
      { total: new Set(plan.sessionsWithoutOrphanView).size }
    )
  }

  if (!APPLY) {
    console.info(
      "[backfill-form-viewed-attribution] DRY-RUN — nada gravado. Rode com --apply para aplicar."
    )
    return
  }

  if (plannedRows.length === 0) {
    console.info("[backfill-form-viewed-attribution] Nada a gravar.")
    return
  }

  // `skipDuplicates` cobre a corrida com o tráfego real: se a linha atribuída
  // nascer entre o plano e a escrita, o eventKey @unique resolve sem erro.
  const created = await prisma.publicFormMetricEvent.createMany({
    data: plannedRows.map((item) => ({
      formId: item.formId,
      publicationId: item.publicationId,
      questionId: null,
      questionSnapshot: Prisma.JsonNull,
      visitorSessionId: item.visitorSessionId,
      eventType: target,
      eventKey: item.eventKey,
      occurredAt: item.occurredAt,
      createdAt: item.createdAt,
      origin: item.origin as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  })

  console.info("[backfill-form-viewed-attribution] Concluído", {
    planejadas: plannedRows.length,
    criadas: created.count,
    ignoradasPorDuplicidade: plannedRows.length - created.count,
  })
  console.info(
    `[backfill-form-viewed-attribution] Reverter: deleteMany em publicFormMetricEvent com origin.backfill = "${BACKFILL_MARKER_BY_TARGET[target]}"`
  )
}

main()
  .catch((error) => {
    console.error("[backfill-form-viewed-attribution] Falhou", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
