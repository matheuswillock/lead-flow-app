#!/usr/bin/env tsx
/**
 * Backfill: funde os perfis Radar duplicados por e-mail (bug 2026-09-03,
 * caso PIMENTAS/KKJ — ver `bugs/2026-09-03-radar-perfil-duplicado-por-email-e-anonimos-com-rastro.md`).
 *
 * Causa raiz (corrigida em `RadarRepository.resolveProfileForPhone`/
 * `resolveProfileForEmail`, nesta mesma mudança): a resolução de perfil por
 * telefone preenchia a COLUNA `normalizedPrimaryEmail` sem reivindicar a
 * `RadarIdentity` exclusiva do e-mail — um contato de e-mail chegando depois
 * nunca encontrava o dono e criava um segundo perfil para a mesma pessoa.
 * 3.163 pares medidos em produção no padrão exato: mesmo time + mesmo e-mail
 * + mesmo nome, um perfil com telefone e um sem.
 *
 * Este script SÓ trata o padrão comprovadamente seguro (ver
 * `lib/radar/backfill-merge-duplicate-email-profiles-planner.ts`): grupo com
 * EXATAMENTE 2 perfis, um com telefone e um sem. Qualquer outra forma
 * (trio, nenhum ou ambos com telefone) é pulada e contada — nunca fundida no
 * escuro. A fusão em si usa `radarRepository.mergeProfiles`, a MESMA rotina
 * de produção usada por `MergeLeadsUseCase`/E3b (corrigida no PR #1148) —
 * nunca reimplementada aqui.
 *
 * Dry-run é o padrão e é SELECT-only por construção (nenhuma escrita ocorre
 * antes do `if (!APPLY) return`). `--apply` grava no banco apontado por
 * DATABASE_URL e só deve rodar com autorização explícita do owner — nunca
 * contra o remoto sem ela.
 *
 * Uso:
 *   bun run scripts/backfill-merge-radar-profiles-duplicados-por-email.ts
 *   bun run scripts/backfill-merge-radar-profiles-duplicados-por-email.ts -- --team-id <uuid>
 *   bun run scripts/backfill-merge-radar-profiles-duplicados-por-email.ts -- --apply
 */

import { prisma } from "@/app/api/infra/data/prisma"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import {
  planDuplicateEmailProfileMerges,
  type DuplicateEmailGroup,
  type DuplicateEmailProfile,
} from "@/lib/radar/backfill-merge-duplicate-email-profiles-planner"

const APPLY = process.argv.includes("--apply")
const LOG = "[backfill-merge-radar-profiles-duplicados-por-email]"

function readFlag(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

async function loadDuplicateGroups(teamId: string | null): Promise<DuplicateEmailGroup[]> {
  const grouped = await prisma.radarProfile.groupBy({
    by: ["teamId", "normalizedPrimaryEmail", "normalizedName"],
    where: {
      normalizedPrimaryEmail: { not: null },
      ...(teamId ? { teamId } : {}),
    },
    _count: { _all: true },
  })

  const duplicateKeys = grouped.filter((row) => row._count._all > 1)

  const groups: DuplicateEmailGroup[] = []
  for (const key of duplicateKeys) {
    // `normalizedPrimaryEmail` já foi filtrado por `not: null` na consulta
    // acima — o `as string` só remove o `| null` que o Prisma mantém no tipo
    // agregado do `groupBy`.
    const normalizedPrimaryEmail = key.normalizedPrimaryEmail as string
    const profiles = await prisma.radarProfile.findMany({
      where: {
        teamId: key.teamId,
        normalizedPrimaryEmail,
        normalizedName: key.normalizedName,
      },
      select: { id: true, normalizedPhone: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })

    groups.push({
      teamId: key.teamId,
      normalizedPrimaryEmail,
      normalizedName: key.normalizedName,
      profiles: profiles as DuplicateEmailProfile[],
    })
  }

  return groups
}

function summarizeSkipReasons(skipped: ReturnType<typeof planDuplicateEmailProfileMerges>["skipped"]) {
  const counts: Record<string, number> = {}
  for (const item of skipped) counts[item.reason] = (counts[item.reason] ?? 0) + 1
  return counts
}

async function main() {
  const teamId = readFlag("team-id")

  console.info(`${LOG} Iniciando`, {
    modo: APPLY ? "APPLY (grava no banco)" : "dry-run (SELECT-only)",
    escopo: teamId ? `time ${teamId}` : "todos os times",
  })

  const groups = await loadDuplicateGroups(teamId)
  const plan = planDuplicateEmailProfileMerges(groups)

  const porTime: Record<string, number> = {}
  for (const item of plan.items) porTime[item.teamId] = (porTime[item.teamId] ?? 0) + 1

  console.info(`${LOG} Plano`, {
    gruposComEmailDuplicado: groups.length,
    paresAFundir: plan.items.length,
    pulados: summarizeSkipReasons(plan.skipped),
    paresPorTime: porTime,
  })

  console.info(`${LOG} Amostra (até 20 pares)`)
  for (const item of plan.items.slice(0, 20)) {
    console.info("  ~", {
      teamId: item.teamId,
      email: item.normalizedPrimaryEmail,
      nome: item.normalizedName,
      vencedor: item.winningProfileId,
      perdedor: item.losingProfileId,
    })
  }
  if (plan.items.length > 20) {
    console.info(`  … e mais ${plan.items.length - 20} par(es).`)
  }

  if (!APPLY) {
    console.info(`${LOG} Dry-run: nada foi gravado. Rode com --apply após autorização.`)
    return
  }

  // `mergeProfiles` sempre usa a política `merge_crm_confirmed` (ver
  // `RadarRepository.mergeProfiles`) — o guard de `lead_id` divergente só
  // recusa fundir sob `preserve_distinct_leads`, então não há "conflito"
  // observável aqui: cada par ou funde ou lança (erro transitório de banco).
  let merged = 0
  let failed = 0

  for (const item of plan.items) {
    try {
      await radarRepository.mergeProfiles(item.teamId, item.losingProfileId, item.winningProfileId)
      merged += 1
    } catch (error) {
      failed += 1
      console.error(`${LOG} Falha ao fundir par — segue retentável`, {
        teamId: item.teamId,
        vencedor: item.winningProfileId,
        perdedor: item.losingProfileId,
        error,
      })
    }
  }

  if (failed > 0) process.exitCode = 1

  console.info(`${LOG} Concluído`, { merged, failed })
}

main()
  .catch((error) => {
    console.error(`${LOG} Falhou`, error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
