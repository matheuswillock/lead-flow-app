#!/usr/bin/env bun
/**
 * Script de validação: compara contagens de segmentos SQL vs memória
 * Para executar: bun run scripts/validate-radar-segment-counts.ts
 */

import { radarService } from "@/app/api/services/radar/RadarService"
import { radarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"
import { countSegmentsLegacyInMemory } from "@/lib/radar/count-segments-legacy"
import { prisma } from "@/app/api/infra/data/prisma"

async function validateSegmentCounts() {
  console.info("[Validator] Buscando times ativos...")

  const teams = await prisma.team.findMany({
    where: {
      deletedAt: null,
    },
    select: { id: true, name: true },
    take: 5,
  })

  if (teams.length === 0) {
    console.info("[Validator] Nenhum time encontrado.")
    return
  }

  console.info(`[Validator] Validando ${teams.length} times...`)

  for (const team of teams) {
    console.info(`\n[Validator] Time: ${team.name} (${team.id})`)

    const scope = {
      teamId: team.id,
      ctx: {
        profileId: "validation-script",
        teamMember: {
          role: "ADMIN",
          functions: [] as string[],
        },
      },
    }

    try {
      const [sqlResult, legacyMap] = await Promise.all([
        radarService.countSegments(scope),
        countSegmentsLegacyInMemory(radarRepository, team.id),
      ])

      const sqlMap = new Map(sqlResult.map((s) => [s.slug, s.count]))

      let hasDivergence = false

      for (const slug of sqlMap.keys()) {
        const sqlCount = sqlMap.get(slug) ?? 0
        const legacyCount = legacyMap.get(slug) ?? 0
        const delta = sqlCount - legacyCount

        if (sqlCount !== legacyCount) {
          console.error(
            `  ❌ ${slug}: SQL=${sqlCount}, Legacy=${legacyCount}, Delta=${delta > 0 ? "+" + delta : delta}`
          )
          hasDivergence = true
        } else {
          console.info(`  ✅ ${slug}: ${sqlCount}`)
        }
      }

      if (!hasDivergence) {
        console.info(`  ✅ Todas as contagens batem!`)
      }
    } catch (error) {
      console.error(`  ❌ Erro ao validar time ${team.id}:`, error)
    }
  }

  await prisma.$disconnect()
  console.info("\n[Validator] Validação concluída.")
}

validateSegmentCounts().catch((error) => {
  console.error("[Validator] Erro fatal:", error)
  process.exit(1)
})
