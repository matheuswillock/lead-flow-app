import { normalizeRadarEmail } from "@/lib/radar/normalization"
import { isUsableRadarDisplayName } from "@/lib/radar/usable-radar-name"

/**
 * Plano do backfill de herança retroativa de identidade do destinatário para
 * perfis "Visitante Anônimo" com rastro de campanha (bug 2026-09-03,
 * passivo do caso KKJ/Kathrein/GPS — ~2.700 perfis recuperáveis medidos em
 * 30 dias).
 *
 * A herança "ao vivo" (E6b, PR #1148) já resolve isso para eventos NOVOS —
 * quando um evento chega com `origin.emailLogId` (`cs_el`), o perfil nasce
 * ou é enriquecido com o nome/e-mail do destinatário via
 * `RadarRepository.resolveProfileForEmail`. O que falta é o passivo: perfis
 * que já existem como anônimos e cujos eventos ANTIGOS carregam o mesmo
 * rastro, mas nunca foram reprocessados.
 *
 * Guarda de divergência (mesmo espírito do E6b/#1107 — `campaign-recipient-
 * identity.ts`): um perfil cujos eventos apontam para MÚLTIPLOS
 * destinatários diferentes é ambíguo (rastro de encaminhamento/reenvio) e
 * NUNCA herda — sem isso a herança colaria a identidade errada com a mesma
 * confiança de um rastro genuíno. Um e-mail já reivindicado por OUTRO perfil
 * também não herda aqui: é um caso de merge (Entrega 2), não de herança —
 * fundir duas pessoas é uma decisão mais pesada que completar um nome vazio,
 * e este backfill não reimplementa `mergeProfilesWithTx`.
 */

export type AnonymousProfileEmailTrace = {
  profileId: string
  teamId: string
  /** `emailLogId`s distintos encontrados em `RadarEvent.metadata.origin.emailLogId` deste perfil. */
  emailLogIds: string[]
}

export type EmailLogRecipient = {
  id: string
  recipientEmail: string
  recipientName: string | null
}

export type InheritancePlanItem = {
  profileId: string
  teamId: string
  recipientEmail: string
  recipientName: string | null
  emailLogId: string
}

export type InheritanceSkipReason =
  | "sem_emaillog_correspondente"
  | "rastro_com_emaillog_nao_resolvido"
  | "multiplos_destinatarios_divergentes"
  | "email_ja_pertence_a_outro_perfil"

export type InheritanceSkip = { profileId: string; reason: InheritanceSkipReason }

export type InheritancePlan = {
  items: InheritancePlanItem[]
  skipped: InheritanceSkip[]
}

/**
 * Chave do mapa de donos de e-mail — SEMPRE por time + e-mail normalizado.
 * Achado codex PR #1155 (P2): chave só por e-mail fazia times diferentes se
 * sobrescreverem no mapa quando o backfill roda sem `--team-id`, e o planner
 * tratava o perfil de OUTRO time como dono (pulando herança válida).
 */
export function emailOwnerKey(teamId: string, normalizedEmail: string): string {
  return `${teamId}:${normalizedEmail}`
}

/**
 * @param traces Um perfil "Visitante Anônimo" (ou sem nome usável) por
 *   entrada, com os `emailLogId`s distintos coletados dos seus eventos.
 * @param emailLogsById `EmailLog` resolvidos (id → destinatário) — só os que
 *   ainda existem/são de campanha entram no mapa; ids ausentes viram
 *   "sem_emaillog_correspondente".
 * @param emailOwnerByTeamAndEmail `emailOwnerKey(teamId, normalizedEmail)` →
 *   profileId que já reivindica a `RadarIdentity` exclusiva desse e-mail no
 *   MESMO time (quando existe).
 */
export function planAnonymousCampaignRecipientInheritance(
  traces: AnonymousProfileEmailTrace[],
  emailLogsById: Map<string, EmailLogRecipient>,
  emailOwnerByTeamAndEmail: Map<string, string>
): InheritancePlan {
  const items: InheritancePlanItem[] = []
  const skipped: InheritanceSkip[] = []

  for (const trace of traces) {
    const logs = trace.emailLogIds
      .map((id) => emailLogsById.get(id))
      .filter((entry): entry is EmailLogRecipient => Boolean(entry))

    if (logs.length === 0) {
      skipped.push({ profileId: trace.profileId, reason: "sem_emaillog_correspondente" })
      continue
    }

    // Achado codex PR #1155 (P1): rastro com evidência INCOMPLETA nunca
    // herda. Se parte dos `emailLogId`s não resolve (log apagado / fora da
    // categoria campaign), o destinatário ausente pode ser DIFERENTE do que
    // sobrou — herdar só do que resolveu colaria a identidade errada com a
    // confiança de um rastro íntegro.
    if (logs.length < trace.emailLogIds.length) {
      skipped.push({ profileId: trace.profileId, reason: "rastro_com_emaillog_nao_resolvido" })
      continue
    }

    const distinctEmails = new Set(logs.map((entry) => normalizeRadarEmail(entry.recipientEmail)))
    if (distinctEmails.size > 1) {
      skipped.push({ profileId: trace.profileId, reason: "multiplos_destinatarios_divergentes" })
      continue
    }

    const chosen = logs[0]
    const normalizedEmail = normalizeRadarEmail(chosen.recipientEmail)
    if (!normalizedEmail) {
      skipped.push({ profileId: trace.profileId, reason: "sem_emaillog_correspondente" })
      continue
    }

    const owner = emailOwnerByTeamAndEmail.get(emailOwnerKey(trace.teamId, normalizedEmail))
    if (owner && owner !== trace.profileId) {
      skipped.push({ profileId: trace.profileId, reason: "email_ja_pertence_a_outro_perfil" })
      continue
    }

    // `EmailLog.recipientName` às vezes é preenchido com o próprio e-mail
    // (placeholder de quando o nome real nunca foi capturado) — herdar isso
    // como `displayName` reproduziria o exato padrão que este backfill
    // existe para corrigir (nome com cara de e-mail). O e-mail em si ainda é
    // herdado normalmente; só o nome-placeholder é descartado.
    const recipientName = isUsableRadarDisplayName(chosen.recipientName) ? chosen.recipientName : null

    items.push({
      profileId: trace.profileId,
      teamId: trace.teamId,
      recipientEmail: chosen.recipientEmail,
      recipientName,
      emailLogId: chosen.id,
    })
  }

  return { items, skipped }
}
