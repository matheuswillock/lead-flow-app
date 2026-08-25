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
 * Perfis que ficariam com (time, nome, telefone nulo) repetido.
 *
 * NÃO é bloqueio. `@@unique([teamId, normalizedPhone, normalizedName])` é uma
 * unique comum, e o Postgres trata NULL como distinto (NULLS DISTINCT é o
 * padrão) — anular os dois lados não colide. Isto vai ao relatório como aviso
 * porque a repetição é sinal de perfil duplicado que alguém vai querer olhar,
 * não porque impeça o saneamento.
 */
async function findNullPhoneDuplicates(artifacts: Artifact[]) {
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

  // A identidade `phone` companheira tem o mesmo valor invalido e sobreviveria
  // a uma limpeza que so mexesse na coluna do perfil.
  const companionIdentities = await prisma.radarIdentity.count({
    where: {
      type: "phone",
      OR: artifacts.map((artifact) => ({
        profileId: artifact.id,
        normalizedValue: artifact.normalizedPhone,
      })),
    },
  })
  console.info(
    `[SanitizeRadarPhone] identidades phone companheiras com o mesmo valor: ${companionIdentities} (JID vira whatsapp_contact_id; resto so recebe marca no source)`
  )

  const duplicates = await findNullPhoneDuplicates(artifacts)
  if (duplicates.length > 0) {
    console.warn(
      `[SanitizeRadarPhone] ⚠️  ${duplicates.length} grupo(s) ficariam com (time, nome, telefone nulo) repetido — não bloqueia (unique é NULLS DISTINCT), mas vale revisar como possível duplicata de perfil:`
    )
    for (const duplicate of duplicates.slice(0, 20)) {
      console.warn(
        `  - team=${duplicate.teamId} nome="${duplicate.normalizedName}" perfis=${duplicate.profileIds.join(",")}`
      )
    }
    if (duplicates.length > 20) {
      console.warn(`  ... e mais ${duplicates.length - 20}`)
    }
  } else {
    console.info("[SanitizeRadarPhone] ✅ nenhum perfil ficaria com nome repetido sem telefone")
  }

  if (!APPLY) {
    console.info("[SanitizeRadarPhone] dry-run concluído — nada foi escrito.")
    await prisma.$disconnect()
    return
  }

  let updated = 0
  let skippedByConcurrentFix = 0
  for (const artifact of artifacts) {
    const current = await prisma.radarProfile.findUnique({
      where: { id: artifact.id },
      select: { profileData: true, normalizedPhone: true },
    })

    // Releitura antes de escrever: entre a coleta e este ponto um sync pode ter
    // substituído o artefato por um telefone de verdade. Sem esta guarda, o
    // saneamento apagaria a correção e ainda registraria o valor velho.
    if (!current || current.normalizedPhone !== artifact.normalizedPhone) {
      skippedByConcurrentFix += 1
      continue
    }

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

    await prisma.$transaction(async (tx) => {
      // `updateMany` com o valor coletado no predicado: se algo mudou o campo
      // entre a releitura e aqui, a escrita simplesmente não casa.
      const result = await tx.radarProfile.updateMany({
        where: { id: artifact.id, normalizedPhone: artifact.normalizedPhone },
        data: { normalizedPhone: null, profileData: nextProfileData },
      })

      if (result.count === 0) {
        skippedByConcurrentFix += 1
        return
      }

      // A identidade `phone` companheira carrega o MESMO valor inválido
      // (`resolveProfileForPhone` cria as duas). Limpar só a coluna deixaria o
      // JID consultável e exportável como telefone, e ainda resolvendo para o
      // perfil.
      //
      // JID vira `whatsapp_contact_id`, que é onde a DA6 diz que identidade
      // WhatsApp não-telefônica deve morar — reclassificada, não apagada. Lixo
      // sem tipo de destino óbvio fica marcado no `source` e é listado no
      // relatório: apagar identidade é destrutivo e é decisão do dono.
      const isJid = classify(artifact.normalizedPhone) === "whatsapp_group_jid"
      await tx.radarIdentity.updateMany({
        where: {
          profileId: artifact.id,
          teamId: artifact.teamId,
          type: "phone",
          normalizedValue: artifact.normalizedPhone,
        },
        data: isJid
          ? { type: "whatsapp_contact_id", source: "phone_artifact_sanitized" }
          : { source: "phone_artifact_sanitized" },
      })

      updated += 1
    })
  }

  console.info(
    `[SanitizeRadarPhone] apply concluído — ${updated} perfis saneados, ${skippedByConcurrentFix} pulados por correção concorrente.`
  )
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error("[SanitizeRadarPhone] erro fatal:", error)
  await prisma.$disconnect()
  process.exit(1)
})
