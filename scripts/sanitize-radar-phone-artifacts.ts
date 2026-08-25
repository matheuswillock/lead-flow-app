#!/usr/bin/env bun
/**
 * Saneamento de `RadarProfile.normalizedPhone` (SPEC 10 — Radar — Backend, E6/DA6).
 *
 * Produção acumulou 242 JIDs de grupo do WhatsApp (`120363…`) e 118 valores de
 * 22-23 dígitos no campo (auditoria CDP §4 R4). Este script move o valor
 * original para `profileData.rawPhoneArtifacts` e anula `normalizedPhone`.
 *
 * DRY-RUN É O PADRÃO. Nada é escrito sem `--apply`, e `--apply` em banco remoto
 * exige autorização explícita do dono (agents.md).
 *
 *   bun run scripts/sanitize-radar-phone-artifacts.ts              # relatório
 *   bun run scripts/sanitize-radar-phone-artifacts.ts --apply      # escreve
 *
 * O relatório inclui as colisões da unique (teamId, normalizedPhone,
 * normalizedName): anular o campo muda a população da constraint, então dois
 * perfis do mesmo time com o mesmo nome e telefone nulo passariam a colidir.
 * Colisão encontrada BLOQUEIA o apply — o desempate é decisão de produto.
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { isRadarPhoneArtifact } from "@/lib/radar/normalization"

const APPLY = process.argv.includes("--apply")
const PAGE_SIZE = 500

type ArtifactClass = "whatsapp_group_jid" | "too_long" | "too_short" | "other"

function classify(value: string): ArtifactClass {
  const digits = value.replace(/\D/g, "")
  if (digits.startsWith("120363")) return "whatsapp_group_jid"
  if (digits.length > 13) return "too_long"
  if (digits.length > 0 && digits.length < 10) return "too_short"
  return "other"
}

type Artifact = {
  id: string
  teamId: string
  normalizedPhone: string
  normalizedName: string
}

async function collectArtifacts(): Promise<Artifact[]> {
  const found: Artifact[] = []
  let cursorId: string | null = null

  for (;;) {
    const where: Prisma.RadarProfileWhereInput = {
      normalizedPhone: { not: null },
      ...(cursorId ? { id: { gt: cursorId } } : {}),
    }

    const page: Array<{
      id: string
      teamId: string
      normalizedPhone: string | null
      normalizedName: string
    }> = await prisma.radarProfile.findMany({
      where,
      select: {
        id: true,
        teamId: true,
        normalizedPhone: true,
        normalizedName: true,
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    })

    if (page.length === 0) break

    for (const profile of page) {
      if (profile.normalizedPhone && isRadarPhoneArtifact(profile.normalizedPhone)) {
        found.push({
          id: profile.id,
          teamId: profile.teamId,
          normalizedPhone: profile.normalizedPhone,
          normalizedName: profile.normalizedName,
        })
      }
    }

    cursorId = page[page.length - 1]!.id
    if (page.length < PAGE_SIZE) break
  }

  return found
}

/**
 * Colisões que o apply criaria: perfis do mesmo time, mesmo nome, cujo telefone
 * passaria a ser nulo (os que já estão nulos hoje contam — a constraint é sobre
 * a população resultante).
 */
async function findUniqueCollisions(artifacts: Artifact[]) {
  const collisions: Array<{ teamId: string; normalizedName: string; profileIds: string[] }> = []
  const byTeamAndName = new Map<string, Artifact[]>()

  for (const artifact of artifacts) {
    const key = `${artifact.teamId}::${artifact.normalizedName ?? ""}`
    const bucket = byTeamAndName.get(key)
    if (bucket) bucket.push(artifact)
    else byTeamAndName.set(key, [artifact])
  }

  for (const [key, group] of byTeamAndName) {
    const [teamId, normalizedName] = key.split("::")
    const alreadyNull = await prisma.radarProfile.findMany({
      where: { teamId, normalizedName, normalizedPhone: null },
      select: { id: true },
    })

    const total = group.length + alreadyNull.length
    if (total > 1) {
      collisions.push({
        teamId: teamId!,
        normalizedName: normalizedName!,
        profileIds: [...group.map((item) => item.id), ...alreadyNull.map((item) => item.id)],
      })
    }
  }

  return collisions
}

async function main() {
  console.info(`[SanitizeRadarPhone] modo: ${APPLY ? "APPLY (escreve)" : "DRY-RUN (somente leitura)"}`)

  const artifacts = await collectArtifacts()
  console.info(`[SanitizeRadarPhone] perfis com artefato em normalizedPhone: ${artifacts.length}`)

  const byClass = new Map<ArtifactClass, number>()
  for (const artifact of artifacts) {
    const key = classify(artifact.normalizedPhone)
    byClass.set(key, (byClass.get(key) ?? 0) + 1)
  }
  for (const [artifactClass, count] of byClass) {
    console.info(`  - ${artifactClass}: ${count}`)
  }

  const collisions = await findUniqueCollisions(artifacts)
  if (collisions.length > 0) {
    console.error(
      `[SanitizeRadarPhone] ❌ ${collisions.length} colisão(ões) da unique (teamId, normalizedPhone, normalizedName) apos anular:`
    )
    for (const collision of collisions.slice(0, 20)) {
      console.error(
        `  - team=${collision.teamId} nome="${collision.normalizedName}" perfis=${collision.profileIds.join(",")}`
      )
    }
    if (collisions.length > 20) {
      console.error(`  ... e mais ${collisions.length - 20}`)
    }
  } else {
    console.info("[SanitizeRadarPhone] ✅ nenhuma colisão da unique apos anular")
  }

  if (!APPLY) {
    console.info("[SanitizeRadarPhone] dry-run concluído — nada foi escrito.")
    await prisma.$disconnect()
    return
  }

  if (collisions.length > 0) {
    console.error(
      "[SanitizeRadarPhone] apply abortado: resolva as colisões antes (o desempate é decisão de produto)."
    )
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  let updated = 0
  for (const artifact of artifacts) {
    const current = await prisma.radarProfile.findUnique({
      where: { id: artifact.id },
      select: { profileData: true },
    })

    const existing =
      current?.profileData && typeof current.profileData === "object"
        ? (current.profileData as Record<string, unknown>)
        : {}
    const previousArtifacts = Array.isArray(existing.rawPhoneArtifacts)
      ? (existing.rawPhoneArtifacts as unknown[])
      : []

    // Reversível: o valor original fica guardado, com a classe e a data.
    const nextProfileData = {
      ...existing,
      rawPhoneArtifacts: [
        ...previousArtifacts,
        {
          value: artifact.normalizedPhone,
          class: classify(artifact.normalizedPhone),
          movedAt: new Date().toISOString(),
        },
      ],
    } as Prisma.InputJsonValue

    await prisma.radarProfile.update({
      where: { id: artifact.id },
      data: { normalizedPhone: null, profileData: nextProfileData },
    })
    updated += 1
  }

  console.info(`[SanitizeRadarPhone] apply concluído — ${updated} perfis saneados.`)
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error("[SanitizeRadarPhone] erro fatal:", error)
  await prisma.$disconnect()
  process.exit(1)
})
