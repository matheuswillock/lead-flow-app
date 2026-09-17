import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/app/api/infra/data/prisma"
import { cacheTags } from "@/lib/cache/cacheTags"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

/**
 * Guarda de tenancy do serving multi-tenant de formulários.
 *
 * O proxy só filtra host + path (barato). Quem garante que o time A não serve
 * formulário do time B no domínio dele é a página `app/forms/[publicId]`:
 * resolve o domínio verificado pelo hostname e exige
 * `form.teamId === domain.teamId`.
 */

/**
 * Mudança de domínio é rara e as mutações (connect/disconnect/verify/cron)
 * invalidam a tag — o TTL é só rede de segurança contra tag perdida.
 */
const TEAM_FORM_DOMAIN_LIFE = { stale: 300, revalidate: 300, expire: 3_600 }

export type VerifiedTeamFormDomain = {
  teamId: string
  hostname: string
}

/**
 * Resolve o domínio de formulários VERIFICADO para um hostname, com cache por
 * tag (`cacheTags.teamFormDomain(hostname)`), invalidada nas rotas de
 * connect/disconnect/verify. Retorna `null` para hostname desconhecido ou
 * ainda não verificado.
 */
export async function getVerifiedTeamFormDomainByHostname(
  hostname: string,
): Promise<VerifiedTeamFormDomain | null> {
  "use cache"
  cacheTag(cacheTags.teamFormDomain(hostname))
  cacheLife(TEAM_FORM_DOMAIN_LIFE)

  const domain = await prisma.teamFormDomain.findUnique({
    where: { hostname },
    select: { teamId: true, hostname: true, status: true },
  })

  if (!domain || domain.status !== "verified") return null
  return { teamId: domain.teamId, hostname: domain.hostname }
}

/**
 * Variante segura para a página pública: falha de cache/banco não pode virar
 * 500 no formulário — vira `null` (a página responde `notFound()`).
 */
export async function resolveVerifiedTeamFormDomainSafely(
  hostname: string,
): Promise<VerifiedTeamFormDomain | null> {
  try {
    return await getVerifiedTeamFormDomainByHostname(hostname)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[resolveVerifiedTeamFormDomainSafely]", error)
    return null
  }
}

/** teamId dono do formulário público (consulta única indexada por publicId). */
export async function findPublicFormTeamId(publicId: string): Promise<string | null> {
  try {
    const form = await prisma.publicForm.findUnique({
      where: { publicId },
      select: { teamId: true },
    })
    return form?.teamId ?? null
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[findPublicFormTeamId]", error)
    return null
  }
}
