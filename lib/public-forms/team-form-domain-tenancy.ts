import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/app/api/infra/data/prisma"
import { cacheTags } from "@/lib/cache/cacheTags"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { classifyFormsHost, normalizeHostname } from "@/lib/proxy/forms-host"

/**
 * Guarda de tenancy do serving multi-tenant de formulários.
 *
 * O proxy só filtra host + path (barato) — e libera tanto `/forms/*` quanto as
 * APIs públicas do formulário em qualquer host de formulários. Quem garante
 * que o time A não serve (nem recebe submissão de) formulário do time B no
 * domínio dele é `isPublicFormServableOnHost`, chamada pela página
 * `app/forms/[publicId]` E pelas rotas `app/api/v1/public-forms/[publicId]/**`.
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

/**
 * Decisão ÚNICA de tenancy por hostname do serving de formulários — a mesma
 * para a página e para as rotas de API.
 *
 * - Host da plataforma e host neutro de fallback: liberado para qualquer time
 *   (fail-open documentado, é o comportamento anterior ao domínio próprio).
 * - Host custom: exige domínio `verified` para aquele hostname E
 *   `form.teamId === domain.teamId`. Qualquer outra combinação é recusada —
 *   inclusive hostname ilegível e domínio não verificado (fail-closed).
 */
export async function isPublicFormServableOnHost(input: {
  publicId: string
  hostHeader: string | null | undefined
}): Promise<boolean> {
  if (classifyFormsHost(input.hostHeader) !== "custom") return true

  const hostname = normalizeHostname(input.hostHeader)
  if (!hostname) return false

  const domain = await resolveVerifiedTeamFormDomainSafely(hostname)
  if (!domain) return false

  const formTeamId = await findPublicFormTeamId(input.publicId)
  return formTeamId !== null && formTeamId === domain.teamId
}
