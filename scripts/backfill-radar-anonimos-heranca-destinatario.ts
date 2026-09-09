#!/usr/bin/env tsx
/**
 * Backfill: herança retroativa de identidade do destinatário para perfis
 * Radar "Visitante Anônimo" com rastro de campanha (bug 2026-09-03, passivo
 * — ver `bugs/2026-09-03-radar-perfil-duplicado-por-email-e-anonimos-com-rastro.md`).
 *
 * Sintoma: segmento "Started" e listas cheias de "Visitante Anônimo" cuja
 * identidade a plataforma já conhece — o evento carrega `origin.emailLogId`
 * (`cs_el` na URL), mas o perfil nasceu anônimo antes de a herança "ao vivo"
 * (E6b, PR #1148) existir, e nunca foi reprocessado.
 *
 * Este script SÓ herda quando o rastro é inequívoco (ver
 * `lib/radar/backfill-anonymous-campaign-recipient-inheritance.ts`): um
 * único destinatário resolvido a partir dos `emailLogId`s do perfil. Perfil
 * com rastro apontando para destinatários DIFERENTES (encaminhamento/reenvio)
 * ou cujo e-mail já pertence a OUTRO perfil (caso de merge, fora de escopo
 * aqui) é pulado e contado — nunca herda no escuro.
 *
 * Dry-run é o padrão e é SELECT-only por construção (nenhuma escrita ocorre
 * antes do `if (!APPLY) return`). `--apply` grava no banco apontado por
 * DATABASE_URL e só deve rodar com autorização explícita do owner — nunca
 * contra o remoto sem ela.
 *
 * Uso:
 *   bun run scripts/backfill-radar-anonimos-heranca-destinatario.ts
 *   bun run scripts/backfill-radar-anonimos-heranca-destinatario.ts -- --since 2026-08-01
 *   bun run scripts/backfill-radar-anonimos-heranca-destinatario.ts -- --team-id <uuid>
 *   bun run scripts/backfill-radar-anonimos-heranca-destinatario.ts -- --apply
 */

import { prisma } from "@/app/api/infra/data/prisma"
import { PUBLIC_FORM_RADAR_SOURCE_TYPE } from "@/lib/radar/map-public-form-metric-to-radar-event"
import { isUsableRadarDisplayName } from "@/lib/radar/usable-radar-name"
import { normalizeRadarEmail, normalizeRadarName } from "@/lib/radar/normalization"
import {
  emailOwnerKey,
  planAnonymousCampaignRecipientInheritance,
  type AnonymousProfileEmailTrace,
  type EmailLogRecipient,
} from "@/lib/radar/backfill-anonymous-campaign-recipient-inheritance"

const APPLY = process.argv.includes("--apply")
const LOG = "[backfill-radar-anonimos-heranca-destinatario]"
const DEFAULT_WINDOW_DAYS = 30
const CHUNK_SIZE = 500

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
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
    console.error(`${LOG} Erro: --since inválido ("${raw}"). Use YYYY-MM-DD.`)
    process.exit(1)
  }
  return parsed
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Espelha `sanitizePublicFormOrigin` (`lib/public-forms/origin.ts`) — só lê o campo já sanitizado na gravação. */
function readOriginEmailLogId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const origin = (metadata as Record<string, unknown>).origin
  if (!origin || typeof origin !== "object" || Array.isArray(origin)) return null
  const emailLogId = (origin as Record<string, unknown>).emailLogId
  return typeof emailLogId === "string" && emailLogId.length > 0 ? emailLogId : null
}

async function loadAnonymousProfileTraces(
  since: Date,
  teamId: string | null
): Promise<AnonymousProfileEmailTrace[]> {
  // Pré-filtro amplo no SQL (evita varrer a tabela inteira); o predicado
  // final de "nome não usável" roda em JS via `isUsableRadarDisplayName`
  // (mesma regra usada no fix de resolução por e-mail — sem duplicar).
  const candidates = await prisma.radarProfile.findMany({
    where: {
      ...(teamId ? { teamId } : {}),
      OR: [{ displayName: "Visitante Anônimo" }, { displayName: "" }, { displayName: { contains: "@" } }],
    },
    select: { id: true, teamId: true, displayName: true },
  })

  const anonymousProfiles = candidates.filter((profile) => !isUsableRadarDisplayName(profile.displayName))
  if (anonymousProfiles.length === 0) return []

  const profileIds = anonymousProfiles.map((profile) => profile.id)
  const emailLogIdsByProfile = new Map<string, Set<string>>()

  for (const ids of chunk(profileIds, CHUNK_SIZE)) {
    const events = await prisma.radarEvent.findMany({
      where: {
        profileId: { in: ids },
        sourceType: PUBLIC_FORM_RADAR_SOURCE_TYPE,
        occurredAt: { gte: since },
      },
      select: { profileId: true, metadata: true },
    })

    for (const event of events) {
      const emailLogId = readOriginEmailLogId(event.metadata)
      if (!emailLogId) continue
      const set = emailLogIdsByProfile.get(event.profileId) ?? new Set<string>()
      set.add(emailLogId)
      emailLogIdsByProfile.set(event.profileId, set)
    }
  }

  return anonymousProfiles
    .filter((profile) => (emailLogIdsByProfile.get(profile.id)?.size ?? 0) > 0)
    .map((profile) => ({
      profileId: profile.id,
      teamId: profile.teamId,
      emailLogIds: [...(emailLogIdsByProfile.get(profile.id) ?? [])],
    }))
}

async function loadEmailLogsById(emailLogIds: string[]): Promise<Map<string, EmailLogRecipient>> {
  const map = new Map<string, EmailLogRecipient>()
  for (const ids of chunk(emailLogIds, CHUNK_SIZE)) {
    const logs = await prisma.emailLog.findMany({
      where: { id: { in: ids }, category: "campaign" },
      select: { id: true, recipientEmail: true, recipientName: true },
    })
    for (const log of logs) map.set(log.id, log)
  }
  return map
}

async function loadEmailOwnerByTeamAndEmail(
  teamIds: string[],
  normalizedEmails: string[]
): Promise<Map<string, string>> {
  // Chave por time+e-mail (emailOwnerKey) — achado codex PR #1155: chave só
  // por e-mail fazia times diferentes se sobrescreverem quando o script roda
  // sem --team-id, e o planner via o perfil de OUTRO time como dono.
  const map = new Map<string, string>()
  for (const ids of chunk(normalizedEmails, CHUNK_SIZE)) {
    const identities = await prisma.radarIdentity.findMany({
      where: { teamId: { in: teamIds }, type: "email", normalizedValue: { in: ids } },
      select: { teamId: true, normalizedValue: true, profileId: true },
    })
    for (const identity of identities) {
      map.set(emailOwnerKey(identity.teamId, identity.normalizedValue), identity.profileId)
    }
  }
  return map
}

function summarizeSkipReasons(skipped: ReturnType<typeof planAnonymousCampaignRecipientInheritance>["skipped"]) {
  const counts: Record<string, number> = {}
  for (const item of skipped) counts[item.reason] = (counts[item.reason] ?? 0) + 1
  return counts
}

async function main() {
  const since = resolveSince()
  const teamId = readFlag("team-id")

  console.info(`${LOG} Iniciando`, {
    modo: APPLY ? "APPLY (grava no banco)" : "dry-run (SELECT-only)",
    desde: since.toISOString(),
    escopo: teamId ? `time ${teamId}` : "todos os times",
  })

  const traces = await loadAnonymousProfileTraces(since, teamId)
  console.info(`${LOG} Perfis anônimos com rastro de campanha (cs_el)`, { total: traces.length })

  if (traces.length === 0) {
    console.info(`${LOG} Nada a fazer.`)
    return
  }

  const allEmailLogIds = [...new Set(traces.flatMap((trace) => trace.emailLogIds))]
  const emailLogsById = await loadEmailLogsById(allEmailLogIds)

  const candidateNormalizedEmails = [...emailLogsById.values()].map((log) => normalizeRadarEmail(log.recipientEmail))
  const teamIds = [...new Set(traces.map((trace) => trace.teamId))]
  const emailOwnerByTeamAndEmail = await loadEmailOwnerByTeamAndEmail(teamIds, candidateNormalizedEmails)

  const plan = planAnonymousCampaignRecipientInheritance(traces, emailLogsById, emailOwnerByTeamAndEmail)

  const porTime: Record<string, number> = {}
  for (const item of plan.items) porTime[item.teamId] = (porTime[item.teamId] ?? 0) + 1

  console.info(`${LOG} Plano`, {
    herdaveis: plan.items.length,
    pulados: summarizeSkipReasons(plan.skipped),
    herdaveisPorTime: porTime,
  })

  console.info(`${LOG} Amostra (até 20 perfis)`)
  for (const item of plan.items.slice(0, 20)) {
    console.info("  ~", {
      teamId: item.teamId,
      profileId: item.profileId,
      destinatario: item.recipientEmail,
      nome: item.recipientName,
      emailLogId: item.emailLogId,
    })
  }
  if (plan.items.length > 20) {
    console.info(`  … e mais ${plan.items.length - 20} perfil(is).`)
  }

  if (!APPLY) {
    console.info(`${LOG} Dry-run: nada foi gravado. Rode com --apply após autorização.`)
    return
  }

  let inherited = 0
  let skippedRaced = 0
  let failed = 0

  for (const item of plan.items) {
    try {
      // Mesma trava de corrida usada em `resolveProfileForEmail` — serializa
      // contra qualquer sync "ao vivo" (E6b) resolvendo o MESMO e-mail neste
      // exato instante, para as duas escritas nunca disputarem a mesma
      // RadarIdentity fora de ordem.
      const normalizedEmail = normalizeRadarEmail(item.recipientEmail)
      const outcome = await prisma.$transaction(async (tx): Promise<"applied" | "skipped_raced"> => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${item.teamId} || ':' || ${normalizedEmail}))`

        const stillOwned = await tx.radarIdentity.findUnique({
          where: { teamId_type_normalizedValue: { teamId: item.teamId, type: "email", normalizedValue: normalizedEmail } },
          select: { profileId: true },
        })
        if (stillOwned && stillOwned.profileId !== item.profileId) {
          // Corrida: um sync concorrente já reivindicou este e-mail para
          // outro perfil entre o planejamento e esta escrita — não rouba, e
          // conta como PULADO (achado codex PR #1155: contar como herdado
          // faria um backfill incompleto parecer 100% aplicado).
          return "skipped_raced"
        }

        const inheritedName = item.recipientName?.trim() || null
        await tx.radarProfile.update({
          where: { id: item.profileId },
          data: {
            primaryEmail: item.recipientEmail,
            normalizedPrimaryEmail: normalizedEmail,
            ...(inheritedName
              ? { displayName: inheritedName, normalizedName: normalizeRadarName(inheritedName) }
              : {}),
          },
        })

        await tx.radarIdentity.upsert({
          where: { teamId_type_normalizedValue: { teamId: item.teamId, type: "email", normalizedValue: normalizedEmail } },
          create: {
            profileId: item.profileId,
            teamId: item.teamId,
            type: "email",
            value: item.recipientEmail,
            normalizedValue: normalizedEmail,
            source: "campaign_recipient_backfill",
            isPrimary: true,
          },
          update: { profileId: item.profileId, value: item.recipientEmail, source: "campaign_recipient_backfill" },
        })
        return "applied"
      })
      if (outcome === "applied") inherited += 1
      else skippedRaced += 1
    } catch (error) {
      failed += 1
      console.error(`${LOG} Falha ao herdar identidade — segue retentável`, {
        profileId: item.profileId,
        error,
      })
    }
  }

  if (failed > 0) process.exitCode = 1

  console.info(`${LOG} Concluído`, { inherited, skippedRaced, failed })
}

main()
  .catch((error) => {
    console.error(`${LOG} Falhou`, error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
