import { describe, expect, it } from "bun:test"
import {
  buildFixedSegmentCountSql,
  buildFixedSegmentCountsSql,
  buildFixedSegmentPredicateSql,
  buildFixedSegmentProfileIdsSql,
} from "./fixed-segment-sql"
import { RADAR_SEGMENT_SLUGS } from "./segment-config"
import { RADAR_EXPORT_MAX_ROWS } from "./exportRadarProfiles"

const TEAM_ID = "11111111-1111-1111-1111-111111111111"
const THRESHOLD = new Date("2026-06-25T00:00:00.000Z")

const FORBIDDEN_MODEL_TABLES = [
  '"RadarProfile"',
  '"RadarConsent"',
  '"RadarChannelConsent"',
  '"RadarSourceLink"',
  '"RadarIdentity"',
  '"RadarEvent"',
  '"Lead"',
]

/** Normaliza espaço em branco para comparar fragmentos de SQL. */
function squash(sql: string): string {
  return sql.replace(/\s+/g, " ").trim()
}

describe("T-SEG.1 — card e lista saem do mesmo predicado", () => {
  it("cobre os 9 slugs de sistema", () => {
    for (const slug of RADAR_SEGMENT_SLUGS) {
      const predicate = buildFixedSegmentPredicateSql(slug, TEAM_ID, THRESHOLD)
      expect(squash(predicate.sql).length).toBeGreaterThan(0)
    }
    expect(RADAR_SEGMENT_SLUGS).toHaveLength(9)
  })

  it.each([...RADAR_SEGMENT_SLUGS])(
    "%s — contagem e listagem embutem o predicado idêntico",
    (slug) => {
      const predicate = squash(buildFixedSegmentPredicateSql(slug, TEAM_ID, THRESHOLD).sql)
      const count = squash(buildFixedSegmentCountSql(slug, TEAM_ID, THRESHOLD).sql)
      const list = squash(
        buildFixedSegmentProfileIdsSql(slug, TEAM_ID, THRESHOLD, { skip: 0, take: 25 }).sql
      )

      // Se o predicado é literalmente o mesmo texto nas duas queries, não há
      // como o card divergir da lista (R6). É a invariante que substitui a
      // sincronização manual entre SQL e matcher em memória.
      expect(count).toContain(predicate)
      expect(list).toContain(predicate)
    }
  )

  it("a contagem agregada embute os 9 predicados numa varredura só", () => {
    const counts = squash(buildFixedSegmentCountsSql(TEAM_ID, THRESHOLD).sql)

    for (const slug of RADAR_SEGMENT_SLUGS) {
      const predicate = squash(buildFixedSegmentPredicateSql(slug, TEAM_ID, THRESHOLD).sql)
      expect(counts).toContain(predicate)
      expect(counts).toContain(`AS "${slug}"`)
    }

    // Uma passada só sobre os perfis do time — não 9 queries.
    expect(counts.match(/FROM "corretor_studio_radar_profiles" p/g)).toHaveLength(1)
  })
})

describe("nomes físicos e escopo multi-tenant (lições B1/B5)", () => {
  const allQueries = [
    buildFixedSegmentCountsSql(TEAM_ID, THRESHOLD),
    ...RADAR_SEGMENT_SLUGS.flatMap((slug) => [
      buildFixedSegmentCountSql(slug, TEAM_ID, THRESHOLD),
      buildFixedSegmentProfileIdsSql(slug, TEAM_ID, THRESHOLD, { skip: 0, take: 25 }),
    ]),
  ]

  it("nunca usa nome de model Prisma como tabela", () => {
    for (const query of allQueries) {
      for (const forbidden of FORBIDDEN_MODEL_TABLES) {
        expect(query.sql.includes(forbidden)).toBe(false)
      }
    }
  })

  it("usa as tabelas físicas do @@map", () => {
    const counts = buildFixedSegmentCountsSql(TEAM_ID, THRESHOLD).sql

    expect(counts).toContain('"corretor_studio_radar_profiles"')
    expect(counts).toContain('"corretor_studio_radar_channel_consents"')
    expect(counts).toContain('"corretor_studio_radar_identities"')
    expect(counts).toContain('"corretor_studio_radar_source_links"')
    expect(counts).toContain('"corretor_studio_radar_events"')
    expect(counts).toContain('"corretor_studio_leads"')
  })

  it("todo teamId é comparado com cast ::uuid", () => {
    for (const query of allQueries) {
      const teamIdComparisons = query.sql.match(/"teamId"\s*=\s*\?/g) ?? []
      expect(teamIdComparisons.length).toBeGreaterThan(0)

      for (const match of query.sql.matchAll(/"teamId"\s*=\s*\?(::uuid)?/g)) {
        expect(match[1]).toBe("::uuid")
      }
    }
  })

  it("usa o valor físico de LeadStatus, não literais inventados", () => {
    const clickedNotClosed = buildFixedSegmentPredicateSql(
      "clicked_not_closed",
      TEAM_ID,
      THRESHOLD
    ).sql

    expect(clickedNotClosed).toContain("'contract_finalized'")
    expect(clickedNotClosed.includes("'WON'")).toBe(false)
    expect(clickedNotClosed.includes("'PAID'")).toBe(false)
  })

  it("passa teamId e datas como parâmetro, nunca interpolados no texto", () => {
    const query = buildFixedSegmentProfileIdsSql("engaged_no_lead", TEAM_ID, THRESHOLD, {
      skip: 50,
      take: 25,
    })

    expect(query.sql).not.toContain(TEAM_ID)
    expect(query.values).toContain(TEAM_ID)
    expect(query.values).toContain(THRESHOLD)
  })
})

describe("paginação no banco", () => {
  it("ordena de forma total para a página ser estável", () => {
    const list = squash(
      buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, { skip: 0, take: 25 }).sql
    )

    // Sem desempate por id, perfis com o mesmo lastSeenAt trocam de página entre
    // requisições — o usuário vê repetido numa página e some na outra.
    expect(list).toContain('ORDER BY p."lastSeenAt" DESC NULLS LAST, p.id ASC')
  })

  it("aplica LIMIT/OFFSET como parâmetro", () => {
    const list = buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, {
      skip: 50,
      take: 25,
    })

    expect(squash(list.sql)).toContain("LIMIT ?")
    expect(squash(list.sql)).toContain("OFFSET ?")
    expect(list.values).toContain(25)
    expect(list.values).toContain(50)
  })
})

describe("LIMIT/OFFSET nunca recebem valor que o Postgres rejeita", () => {
  // A paginacao em memoria (`ids.slice`) coagia NaN/Infinity/fracionario em
  // silencio; com LIMIT/OFFSET no banco o mesmo valor vira 500.
  const hostile: Array<{ skip: number; take: number }> = [
    { skip: Number.NaN, take: Number.NaN },
    { skip: Number.POSITIVE_INFINITY, take: Number.POSITIVE_INFINITY },
    { skip: -10, take: -5 },
    { skip: 1.5, take: 2.7 },
    { skip: 0, take: 0 },
  ]

  it.each(hostile)("sanitiza skip=$skip take=$take", (pagination) => {
    const query = buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, pagination)

    const numeric = query.values.filter((value): value is number => typeof value === "number")
    expect(numeric.length).toBeGreaterThan(0)
    for (const value of numeric) {
      expect(Number.isSafeInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it("mantem os valores validos intactos", () => {
    const query = buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, {
      skip: 40,
      take: 20,
    })

    expect(query.values).toContain(20)
    expect(query.values).toContain(40)
  })

  it("limita take a um teto, para nao virar varredura acidental", () => {
    const query = buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, {
      skip: 0,
      take: 10_000,
    })

    expect(query.values).toContain(RADAR_EXPORT_MAX_ROWS)
    expect(query.values).not.toContain(10_000)
  })

  // O teto nao pode ficar abaixo do maior consumidor legitimo: o export pede
  // RADAR_EXPORT_MAX_ROWS de uma vez, e um LIMIT menor cortaria em silencio —
  // com `truncated` derivado do total ainda dizendo que nao cortou.
  it("nao corta o take do export de segmento", () => {
    const query = buildFixedSegmentProfileIdsSql("crm_clients", TEAM_ID, THRESHOLD, {
      skip: 0,
      take: RADAR_EXPORT_MAX_ROWS,
    })

    expect(query.values).toContain(RADAR_EXPORT_MAX_ROWS)
  })
})

describe("reserva provisoria de promocao nao conta como Lead", () => {
  // Interacao entre estagios: a reserva `pending:` que a promocao cria (E5) é
  // `type = 'lead_id'`, mas nao e vinculo com o CRM. Conta-la poria o perfil em
  // crm_clients e o tiraria de engaged_no_lead — a fila de promocao — durante a
  // promocao inteira, e para sempre se a liberacao falhar.
  it("crm_clients exclui as reservas pending:", () => {
    const sql = buildFixedSegmentPredicateSql("crm_clients", TEAM_ID, THRESHOLD)

    expect(squash(sql.sql)).toContain('i."normalizedValue" NOT LIKE ?')
    expect(sql.values).toContain("pending:%")
  })

  it("engaged_no_lead nao perde perfil so por causa de uma reserva", () => {
    const sql = buildFixedSegmentPredicateSql("engaged_no_lead", TEAM_ID, THRESHOLD)

    expect(squash(sql.sql)).toContain('i."normalizedValue" NOT LIKE ?')
    expect(sql.values).toContain("pending:%")
  })
})
