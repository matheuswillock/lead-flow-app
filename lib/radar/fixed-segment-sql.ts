import { Prisma } from "@prisma/client"
import { RADAR_SEGMENT_SLUGS, type RadarSegmentSlug } from "./segment-config"

/**
 * Predicados SQL dos segmentos de sistema — fonte ÚNICA para card e lista.
 *
 * Antes existiam duas verdades (auditoria CDP §4 R6): o card contava por SQL
 * (`countFixedSegmentsSQL`) e a lista resolvia TODOS os ids em memória, com um
 * matcher independente (`profileMatchesRadarSegment`) + `slice`. Duas
 * implementações do mesmo conceito divergem sozinhas — e o caminho em memória
 * ainda carregava a base inteira do time, que é a origem do P2035 (32.768 bind
 * vars) na rota de perfis de segmento.
 *
 * Agora contagem e listagem consomem o MESMO predicado daqui. `count ===
 * list.length` deixa de ser algo a sincronizar na mão e passa a ser verdade por
 * construção — travado por teste (T-SEG.1).
 *
 * Contrato do predicado: é uma expressão booleana que referencia APENAS o alias
 * `p` (`corretor_studio_radar_profiles`). Quem monta a query decide se `p` está
 * num `COUNT(*) FILTER (...)` ou num `WHERE` paginado.
 *
 * Nomes físicos (`@@map`) e `::uuid` em todo `teamId` são obrigatórios —
 * lições B1/B5 do RADAR_AUDIT §9.
 */

const PROFILES_TABLE = Prisma.raw('"corretor_studio_radar_profiles"')

function hasBlockedEmailConsent(teamId: string): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_channel_consents" c
    WHERE c."profileId" = p.id AND c."teamId" = ${teamId}::uuid
      AND c."channel" = 'email' AND c."status" = 'blocked'
  )`
}

function hasAllowedEmailConsent(teamId: string): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_channel_consents" c
    WHERE c."profileId" = p.id AND c."teamId" = ${teamId}::uuid
      AND c."channel" = 'email' AND c."status" = 'allowed'
  )`
}

function hasAnyEmailConsent(teamId: string): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_channel_consents" c
    WHERE c."profileId" = p.id AND c."teamId" = ${teamId}::uuid
      AND c."channel" = 'email'
  )`
}

function hasPortfolioLink(teamId: string): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_source_links" sl
    WHERE sl."profileId" = p.id AND sl."teamId" = ${teamId}::uuid
      AND sl."sourceType" = 'portfolio'
  )`
}

function hasLeadIdentity(teamId: string): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_identities" i
    WHERE i."profileId" = p.id AND i."teamId" = ${teamId}::uuid
      AND i."type" = 'lead_id'
  )`
}

function hasRecentCampaignSend(teamId: string, recentThreshold: Date): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_events" e
    WHERE e."profileId" = p.id AND e."teamId" = ${teamId}::uuid
      AND e."eventType" = 'email.sent'
      AND e."occurredAt" >= ${recentThreshold}
  )`
}

/** Fechado = está na carteira ou tem lead com contrato finalizado no CRM. */
function isClosed(teamId: string): Prisma.Sql {
  return Prisma.sql`(
    ${hasPortfolioLink(teamId)}
    OR EXISTS(
      SELECT 1 FROM "corretor_studio_radar_identities" i
      INNER JOIN "corretor_studio_leads" l ON i."normalizedValue" = l.id::text
      WHERE i."profileId" = p.id AND i."teamId" = ${teamId}::uuid
        AND i."type" = 'lead_id'
        AND l."teamId" = ${teamId}::uuid
        AND l."status" IN ('contract_finalized')
    )
  )`
}

/**
 * Abriu alguma campanha e NÃO clicou naquela mesma campanha.
 *
 * O pareamento é por `campaignId`: quem abriu a campanha A e clicou na B
 * continua no segmento por causa de A.
 */
function openedWithoutClickInSameCampaign(teamId: string, recentThreshold: Date): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_events" o
    WHERE o."profileId" = p.id AND o."teamId" = ${teamId}::uuid
      AND o."eventType" = 'email.opened'
      AND o."occurredAt" >= ${recentThreshold}
      AND o."metadata"->>'campaignId' IS NOT NULL
      AND NOT EXISTS(
        SELECT 1 FROM "corretor_studio_radar_events" cl
        WHERE cl."profileId" = p.id AND cl."teamId" = ${teamId}::uuid
          AND cl."eventType" = 'email.clicked'
          AND cl."occurredAt" >= ${recentThreshold}
          AND cl."metadata"->>'campaignId' = o."metadata"->>'campaignId'
      )
  )`
}

function clickedAnyCampaign(teamId: string, recentThreshold: Date): Prisma.Sql {
  return Prisma.sql`EXISTS(
    SELECT 1 FROM "corretor_studio_radar_events" cl
    WHERE cl."profileId" = p.id AND cl."teamId" = ${teamId}::uuid
      AND cl."eventType" = 'email.clicked'
      AND cl."occurredAt" >= ${recentThreshold}
      AND cl."metadata"->>'campaignId' IS NOT NULL
  )`
}

function hasRecentEngagement(teamId: string, recentThreshold: Date): Prisma.Sql {
  return Prisma.sql`(
    EXISTS(
      SELECT 1 FROM "corretor_studio_radar_events" e
      WHERE e."profileId" = p.id AND e."teamId" = ${teamId}::uuid
        AND e."eventType" IN ('email.opened', 'email.clicked')
        AND e."occurredAt" >= ${recentThreshold}
    )
    OR EXISTS(
      SELECT 1 FROM "corretor_studio_radar_events" e
      WHERE e."profileId" = p.id AND e."teamId" = ${teamId}::uuid
        AND e."eventType" IN ('form.viewed', 'form.started')
        AND e."occurredAt" >= ${recentThreshold}
    )
  )`
}

function isRenewalDue(teamId: string): Prisma.Sql {
  return Prisma.sql`(
    EXISTS(
      SELECT 1 FROM "corretor_studio_radar_events" e
      WHERE e."profileId" = p.id AND e."teamId" = ${teamId}::uuid
        AND e."eventType" = 'portfolio.renewal_due'
    )
    OR EXISTS(
      SELECT 1 FROM "corretor_studio_radar_source_links" sl
      WHERE sl."profileId" = p.id AND sl."teamId" = ${teamId}::uuid
        AND sl."sourceType" = 'portfolio'
        AND sl."sourceMetadata"->>'renewalStatus' IN ('to_renew', 'contacted')
    )
  )`
}

/**
 * Predicado booleano do segmento de sistema, sobre o alias `p`.
 *
 * `recentThreshold` é a borda da janela de campanha recente
 * (`RECENT_CAMPAIGN_WINDOW_DAYS`), já resolvida em `Date` pelo caller — assim a
 * mesma borda vale para o card e para a lista da mesma requisição.
 */
export function buildFixedSegmentPredicateSql(
  slug: RadarSegmentSlug,
  teamId: string,
  recentThreshold: Date
): Prisma.Sql {
  switch (slug) {
    case "email_marketable":
      return Prisma.sql`(
        p."normalizedPrimaryEmail" IS NOT NULL
        AND p."normalizedPrimaryEmail" != ''
        AND NOT ${hasBlockedEmailConsent(teamId)}
        AND (${hasAllowedEmailConsent(teamId)} OR NOT ${hasAnyEmailConsent(teamId)})
      )`

    case "email_blocked":
      return hasBlockedEmailConsent(teamId)

    case "opened_not_clicked":
      return openedWithoutClickInSameCampaign(teamId, recentThreshold)

    case "clicked_not_closed":
      return Prisma.sql`(
        ${clickedAnyCampaign(teamId, recentThreshold)}
        AND NOT ${isClosed(teamId)}
      )`

    case "engaged_no_lead":
      return Prisma.sql`(
        NOT ${hasLeadIdentity(teamId)}
        AND ${hasRecentEngagement(teamId, recentThreshold)}
      )`

    case "portfolio_renewal_due":
      return isRenewalDue(teamId)

    case "inactive_recent_campaign":
      return Prisma.sql`(NOT ${hasRecentCampaignSend(teamId, recentThreshold)})`

    case "portfolio_clients":
      return hasPortfolioLink(teamId)

    case "crm_clients":
      return hasLeadIdentity(teamId)
  }
}

/**
 * Contagem dos 9 segmentos numa varredura só.
 *
 * `COUNT(*) FILTER` mantém o custo de uma passada única sobre os perfis do time
 * — e usa exatamente os mesmos predicados da listagem.
 */
export function buildFixedSegmentCountsSql(teamId: string, recentThreshold: Date): Prisma.Sql {
  const columns = RADAR_SEGMENT_SLUGS.map(
    (slug) =>
      Prisma.sql`COUNT(*) FILTER (WHERE ${buildFixedSegmentPredicateSql(
        slug,
        teamId,
        recentThreshold
      )}) AS ${Prisma.raw(`"${slug}"`)}`
  )

  return Prisma.sql`
    SELECT ${Prisma.join(columns, ", ")}
    FROM ${PROFILES_TABLE} p
    WHERE p."teamId" = ${teamId}::uuid
  `
}

/** Contagem de um único segmento — mesmo predicado da listagem. */
export function buildFixedSegmentCountSql(
  slug: RadarSegmentSlug,
  teamId: string,
  recentThreshold: Date
): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM ${PROFILES_TABLE} p
    WHERE p."teamId" = ${teamId}::uuid
      AND ${buildFixedSegmentPredicateSql(slug, teamId, recentThreshold)}
  `
}

/**
 * Página de ids do segmento, ordenada e paginada NO BANCO.
 *
 * A ordenação é explícita porque o caminho em memória que isto substitui não
 * tinha nenhuma (`listProfilesForSegmentation` não declarava `orderBy`), então
 * a paginação podia repetir ou pular perfis entre páginas. `id` desempata para
 * a ordem ser total — sem isso, perfis com o mesmo `lastSeenAt` embaralham
 * entre páginas.
 */
export function buildFixedSegmentProfileIdsSql(
  slug: RadarSegmentSlug,
  teamId: string,
  recentThreshold: Date,
  pagination: { skip: number; take: number }
): Prisma.Sql {
  return Prisma.sql`
    SELECT p.id
    FROM ${PROFILES_TABLE} p
    WHERE p."teamId" = ${teamId}::uuid
      AND ${buildFixedSegmentPredicateSql(slug, teamId, recentThreshold)}
    ORDER BY p."lastSeenAt" DESC NULLS LAST, p.id ASC
    LIMIT ${toSafeLimit(pagination.take)} OFFSET ${toSafeOffset(pagination.skip)}
  `
}

const MAX_PAGE_SIZE = 1000

/**
 * O Postgres rejeita `NaN`, `Infinity` e fracionário em `LIMIT`/`OFFSET`, e o
 * erro sobe como 500. A rota já valida a query string, mas este builder é uma
 * primitiva compartilhada: deixar a garantia só no chamador significa que o
 * próximo chamador reintroduz o bug. Enquanto a paginação era `ids.slice()` em
 * memória, esses valores eram coagidos em silêncio.
 */
function toSafeLimit(take: number): number {
  if (!Number.isSafeInteger(take) || take <= 0) return 1
  return Math.min(take, MAX_PAGE_SIZE)
}

function toSafeOffset(skip: number): number {
  if (!Number.isSafeInteger(skip) || skip < 0) return 0
  return skip
}
