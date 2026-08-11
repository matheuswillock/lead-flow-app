#!/usr/bin/env tsx
/**
 * One-off: backfill de RadarEvents email.clicked perdidos por catch silencioso em appendEventIfNew (E5.2).
 *
 * Times afetados (auditoria 2026-08-10):
 *   Kathrein Antunes:    28f7b9e8-9516-4a08-864c-9ff3e085ba87 (5 eventos)
 *   Avalanche de Vendas: aef1bfe7-d1fc-4085-879e-81d51a0cc9b8 (12 eventos)
 *
 * Uso:
 *   bun run scripts/backfill-missing-radar-click-events.ts                         # dry-run (padrão)
 *   bun run scripts/backfill-missing-radar-click-events.ts --apply                 # grava (requer autorização)
 *   bun run scripts/backfill-missing-radar-click-events.ts --discover              # lista logIds órfãos (stdout)
 *   bun run scripts/backfill-missing-radar-click-events.ts --discover --write-fixture  # atualiza fixture JSON
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  runBackfillMissingRadarClickEvents,
  type BackfillClickCandidate,
} from "@/lib/radar/backfill-missing-radar-click-events"
import { teamHasRadarFeature } from "@/lib/radar/team-has-radar-feature"
import {
  isValidRadarPrimaryIdentity,
  normalizeRadarEmail,
  normalizeRadarName,
  normalizeRadarPhone,
  formatDisplayPhone,
} from "@/lib/radar/normalization"

const APPLY = process.argv.includes("--apply")
const DISCOVER = process.argv.includes("--discover")
const WRITE_FIXTURE = process.argv.includes("--write-fixture")

const FIXTURE_PATH = join(
  import.meta.dir,
  "fixtures/missing-radar-click-events.json"
)

type FixtureFile = {
  description: string
  expectedCount: number
  teams: {
    kathrein: string
    avalanche: string
  }
  logIds: string[]
}

const prisma = new PrismaClient()

function loadFixture(): FixtureFile {
  const raw = readFileSync(FIXTURE_PATH, "utf8")
  return JSON.parse(raw) as FixtureFile
}

function teamIdsFromFixture(fixture: FixtureFile): string[] {
  return [fixture.teams.kathrein, fixture.teams.avalanche]
}

async function discoverOrphanClickLogIds(teamIds: string[]): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ log_id: string }>>`
    SELECT el.id AS log_id
    FROM corretor_studio_email_logs el
    WHERE el."clickedAt" IS NOT NULL
      AND el."teamId" IN (${teamIds[0]}::uuid, ${teamIds[1]}::uuid)
      AND NOT EXISTS (
        SELECT 1
        FROM corretor_studio_radar_events re
        WHERE re."teamId" = el."teamId"
          AND re."sourceType" = 'email_log'
          AND re."sourceId" = el.id::text
          AND re."eventType" = 'email.clicked'
      )
    ORDER BY el."clickedAt" ASC
  `

  return rows.map((row) => row.log_id)
}

async function loadCandidateFromLogId(logId: string): Promise<BackfillClickCandidate | null> {
  const log = await prisma.emailLog.findUnique({
    where: { id: logId },
    select: {
      id: true,
      teamId: true,
      recipientEmail: true,
      recipientName: true,
      campaignId: true,
      clickedAt: true,
      events: {
        where: { type: "clicked" },
        orderBy: { occurredAt: "asc" },
        take: 1,
        select: {
          occurredAt: true,
          metadata: true,
        },
      },
    },
  })

  if (!log?.clickedAt) return null

  const clickEvent = log.events[0]
  const occurredAt = clickEvent?.occurredAt ?? log.clickedAt
  const metadata =
    clickEvent?.metadata && typeof clickEvent.metadata === "object" && !Array.isArray(clickEvent.metadata)
      ? (clickEvent.metadata as Record<string, unknown>)
      : undefined

  return {
    logId: log.id,
    teamId: log.teamId,
    recipientEmail: log.recipientEmail,
    recipientName: log.recipientName,
    campaignId: log.campaignId,
    occurredAt,
    metadata,
  }
}

async function loadCandidates(logIds: string[]): Promise<BackfillClickCandidate[]> {
  const candidates: BackfillClickCandidate[] = []

  for (const logId of logIds) {
    const candidate = await loadCandidateFromLogId(logId)
    if (!candidate) {
      console.warn(`[backfill-missing-radar-click-events] logId ${logId} ignorado — log inexistente ou sem clickedAt`)
      continue
    }
    candidates.push(candidate)
  }

  return candidates
}

async function resolveProfileIdForCandidate(
  candidate: BackfillClickCandidate
): Promise<string | null> {
  if (!(await teamHasRadarFeature(candidate.teamId))) return null

  const normalizedEmail = normalizeRadarEmail(candidate.recipientEmail)
  const lead = candidate.recipientName
    ? await radarRepository.findLeadPhoneByEmail(candidate.teamId, normalizedEmail)
    : null

  const hasValidPhone = Boolean(
    candidate.recipientName &&
      lead?.phone &&
      isValidRadarPrimaryIdentity(lead.phone, candidate.recipientName)
  )

  const resolved = hasValidPhone
    ? await radarRepository.resolveProfileForPhone({
        teamId: candidate.teamId,
        normalizedPhone: normalizeRadarPhone(lead!.phone),
        normalizedName: normalizeRadarName(candidate.recipientName!),
        displayName: candidate.recipientName!.trim(),
        displayPhone: formatDisplayPhone(lead!.phone),
        phoneValue: lead!.phone,
        phoneSource: "email",
        primaryEmail: candidate.recipientEmail,
        normalizedPrimaryEmail: normalizedEmail,
        lastSeenAt: candidate.occurredAt,
      })
    : await radarRepository.resolveProfileForEmail({
        teamId: candidate.teamId,
        normalizedEmail,
        emailValue: candidate.recipientEmail,
        displayName: candidate.recipientName?.trim() ?? null,
        normalizedName: candidate.recipientName
          ? normalizeRadarName(candidate.recipientName)
          : null,
        emailSource: "email_log",
        lastSeenAt: candidate.occurredAt,
      })

  return resolved.profile.id
}

async function hasExistingRadarClickEvent(
  candidate: BackfillClickCandidate
): Promise<boolean> {
  return radarRepository.hasDuplicateEvent(
    candidate.teamId,
    "email_log",
    candidate.logId,
    "email.clicked",
    candidate.occurredAt
  )
}

function printSummary(result: Awaited<ReturnType<typeof runBackfillMissingRadarClickEvents>>) {
  console.info("\n═══════════════════════════════════════════════════════")
  console.info("📊 Resultado:")
  console.info(`   Total candidatos: ${result.total}`)
  if (result.mode === "dry-run") {
    console.info(`   Seriam criados: ${result.wouldCreate}`)
  } else {
    console.info(`   Criados: ${result.created}`)
  }
  console.info(`   Já existiam (skip): ${result.skippedExisting}`)
  console.info(`   Falharam: ${result.failed}`)

  if (result.errors.length > 0) {
    console.info("\n   Erros:")
    for (const entry of result.errors) {
      console.info(`     - ${entry.logId}: ${entry.error}`)
    }
  }

  if (!APPLY) {
    console.info("\n⚡ Execute com --apply para gravar os RadarEvents no banco.")
    console.info("   ATENÇÃO: solicite autorização do owner antes de rodar --apply em produção.")
  }
  console.info("═══════════════════════════════════════════════════════")
}

async function main() {
  const fixture = loadFixture()
  const teamIds = teamIdsFromFixture(fixture)

  if (DISCOVER) {
    const discovered = await discoverOrphanClickLogIds(teamIds)
    console.info(`\n🔍 ${discovered.length} logIds órfãos descobertos (esperado: ${fixture.expectedCount}):\n`)
    for (const logId of discovered) {
      console.info(`  ${logId}`)
    }

    if (WRITE_FIXTURE) {
      const updated: FixtureFile = {
        ...fixture,
        logIds: discovered,
      }
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8")
      console.info(`\n✅ Fixture atualizado em ${FIXTURE_PATH}`)
    }

    return
  }

  let logIds = fixture.logIds
  if (logIds.length === 0) {
    console.info("[backfill-missing-radar-click-events] Fixture sem logIds — descobrindo órfãos no banco...")
    logIds = await discoverOrphanClickLogIds(teamIds)
  }

  if (logIds.length !== fixture.expectedCount) {
    console.warn(
      `[backfill-missing-radar-click-events] Aviso: ${logIds.length} candidatos vs ${fixture.expectedCount} esperados na auditoria`
    )
  }

  const candidates = await loadCandidates(logIds)

  console.info("═══════════════════════════════════════════════════════")
  console.info("🔧 Backfill RadarEvents email.clicked (E5.2)")
  console.info(`   Modo: ${APPLY ? "APPLY (grava no banco)" : "DRY-RUN"}`)
  console.info(`   Candidatos carregados: ${candidates.length}`)
  console.info("═══════════════════════════════════════════════════════")

  const result = await runBackfillMissingRadarClickEvents({
    apply: APPLY,
    candidates,
    hasExistingEvent: hasExistingRadarClickEvent,
    resolveProfileId: resolveProfileIdForCandidate,
    appendEventIfNew: (input) => radarRepository.appendEventIfNew(input),
  })

  printSummary(result)

  if (result.failed > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error("[backfill-missing-radar-click-events] erro fatal:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
