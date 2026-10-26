import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/app/api/infra/data/prisma"
import { cacheTags } from "@/lib/cache/cacheTags"
import { normalizeHostname, classifyFormsHost } from "@/lib/proxy/forms-host"

const TEAM_STUDIO_DOMAIN_LIFE = { stale: 300, revalidate: 300, expire: 3_600 }
const studioDomainCacheTag =
  cacheTags.teamStudioDomain ?? ((hostname: string) => `team-studio-domain:${hostname}`)

export type VerifiedTeamStudioDomain = {
  teamId: string
  hostname: string
}

export async function getVerifiedTeamStudioDomainByHostname(
  hostname: string,
): Promise<VerifiedTeamStudioDomain | null> {
  "use cache"
  cacheTag(studioDomainCacheTag(hostname))
  cacheLife(TEAM_STUDIO_DOMAIN_LIFE)

  let domain: { teamId: string; hostname: string; status: string } | null = null
  try {
    const studioDomainModel = (prisma as unknown as {
      teamStudioDomain?: { findUnique: typeof prisma.teamStudioDomain.findUnique }
    }).teamStudioDomain
    if (!studioDomainModel) return null
    domain = await studioDomainModel.findUnique({
      where: { hostname },
      select: { teamId: true, hostname: true, status: true },
    })
  } catch (error) {
    console.error("[getVerifiedTeamStudioDomainByHostname]", error)
    return null
  }

  if (!domain || domain.status !== "verified") return null
  return { teamId: domain.teamId, hostname: domain.hostname }
}

async function findResourceTeamId(resource: "form" | "landing", publicId: string) {
  if (resource === "form") {
    const form = await prisma.publicForm.findUnique({ where: { publicId }, select: { teamId: true } })
    return form?.teamId ?? null
  }

  const landing = await prisma.landingPage.findUnique({ where: { publicId }, select: { teamId: true } })
  return landing?.teamId ?? null
}

export async function isPublicResourceServableOnStudioHost(input: {
  resource: "form" | "landing"
  publicId: string
  hostHeader: string | null | undefined
}) {
  if (classifyFormsHost(input.hostHeader) !== "custom") return true
  const hostname = normalizeHostname(input.hostHeader)
  if (!hostname) return false

  const domain = await getVerifiedTeamStudioDomainByHostname(hostname)
  if (!domain) return false

  const resourceTeamId = await findResourceTeamId(input.resource, input.publicId)
  return resourceTeamId !== null && resourceTeamId === domain.teamId
}

export async function resolveLegacyPublicHostRedirect(input: {
  resource: "form" | "landing"
  publicId: string
  hostHeader: string | null | undefined
}) {
  if (classifyFormsHost(input.hostHeader) !== "custom") return null
  const hostname = normalizeHostname(input.hostHeader)
  if (!hostname) return null

  const currentDomain = await getVerifiedTeamStudioDomainByHostname(hostname)
  if (currentDomain) return null

  const legacyDomain = input.resource === "form"
    ? await prisma.teamFormDomain.findFirst({ where: { hostname, status: "verified" }, select: { teamId: true } })
    : await prisma.teamLandingDomain.findFirst({ where: { hostname, status: "verified" }, select: { teamId: true } })
  if (!legacyDomain) return null

  const resourceTeamId = await findResourceTeamId(input.resource, input.publicId)
  if (resourceTeamId !== legacyDomain.teamId) return null

  const studioDomain = await prisma.teamStudioDomain.findFirst({
    where: { teamId: legacyDomain.teamId, status: "verified" },
    select: { hostname: true },
  })
  return studioDomain ? `https://${studioDomain.hostname}` : null
}
