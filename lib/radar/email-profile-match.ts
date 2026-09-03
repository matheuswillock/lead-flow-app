import { isUsableRadarDisplayName } from "@/lib/radar/usable-radar-name"

export type EmailProfileMatchCandidate = {
  displayName: string | null
  normalizedName: string | null
  normalizedPhone: string | null
}

export type EmailProfileMatchDecision =
  | { action: "enrich" }
  | { action: "create_separate"; reason: "shared_email_different_person" }

/**
 * Decide o que fazer quando um contato de e-mail (sem telefone próprio nesta
 * chamada — `resolveProfileForEmail` só é acionado quando não há telefone
 * válido disponível) casa, pelo fallback de coluna
 * (`RadarProfile.normalizedPrimaryEmail`), com um perfil que NÃO tem a
 * `RadarIdentity` exclusiva desse e-mail reivindicada.
 *
 * Causa raiz do bug 2026-09-03 (caso PIMENTAS/KKJ): `resolveProfileForPhone`
 * historicamente resolvia telefone+e-mail e preenchia a COLUNA
 * `normalizedPrimaryEmail` do perfil, mas nunca reivindicava a
 * `RadarIdentity` de e-mail correspondente (só a de telefone) — perfis assim
 * ficavam "com e-mail órfão". Sem este fallback+guarda, um contato de e-mail
 * chegando depois nunca encontrava o dono e criava um segundo perfil para a
 * mesma pessoa (3.163 pares medidos em produção).
 *
 * Guarda de e-mail compartilhado (ex.: contato@empresa usado por pessoas
 * diferentes): só recusa enriquecer — e cria um perfil separado — quando o
 * candidato já tem um nome PRÓPRIO usável (não é um perfil email-only vazio
 * ou "Visitante Anônimo") que DIVERGE do nome do contato atual, E esse
 * candidato já tem telefone próprio (identidade estabelecida e independente
 * do e-mail, não uma sobra "sem dono" ainda esperando ser completada). Nesse
 * caso os dois contatos são pessoas diferentes usando a mesma caixa postal; o
 * novo contato ganha um perfil separado e NÃO reivindica a `RadarIdentity` de
 * e-mail (que continua exclusiva do dono original — o schema não permite dois
 * donos para o mesmo `[teamId, type, normalizedValue]`).
 */
/**
 * Seleciona, entre TODOS os perfis legados da mesma caixa postal (match pela
 * coluna `normalizedPrimaryEmail`), o candidato compatível com o contato
 * atual — achado codex PR #1155 (P2): escolher só o mais antigo
 * (`findFirst` asc) fazia o divergente estabelecido "bloquear" a fila e cada
 * novo sync do mesmo contato secundário criar mais um perfil duplicado.
 *
 * Precedência: (1) candidato com `normalizedName` IDÊNTICO ao contato
 * (mesma pessoa, mesmo estabelecida); (2) primeiro candidato enriquecível
 * pela guarda `decideEmailProfileMatch` (sem nome usável ou sem telefone
 * próprio). Se todos forem pessoas estabelecidas divergentes, retorna
 * `null` — o chamador cria um perfil separado.
 */
export function pickCompatibleEmailColumnCandidate<T extends EmailProfileMatchCandidate>(
  candidates: T[],
  incomingNormalizedName: string | null
): T | null {
  if (incomingNormalizedName) {
    const sameName = candidates.find(
      (candidate) => candidate.normalizedName === incomingNormalizedName
    )
    if (sameName) return sameName
  }

  return (
    candidates.find(
      (candidate) =>
        decideEmailProfileMatch({ candidate, incomingNormalizedName }).action === "enrich"
    ) ?? null
  )
}

export function decideEmailProfileMatch(input: {
  candidate: EmailProfileMatchCandidate
  incomingNormalizedName: string | null
}): EmailProfileMatchDecision {
  const candidateNameUsable = isUsableRadarDisplayName(input.candidate.displayName)
  const namesDiverge =
    candidateNameUsable &&
    Boolean(input.incomingNormalizedName) &&
    input.candidate.normalizedName !== input.incomingNormalizedName
  const candidateIsEstablishedPerson = candidateNameUsable && Boolean(input.candidate.normalizedPhone)

  if (namesDiverge && candidateIsEstablishedPerson) {
    return { action: "create_separate", reason: "shared_email_different_person" }
  }
  return { action: "enrich" }
}
