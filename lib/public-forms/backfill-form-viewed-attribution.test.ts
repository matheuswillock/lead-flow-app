import { describe, expect, it } from "bun:test"
import {
  applyEmailLogAttribution,
  collectUnattributedEmailLogIds,
  FORM_VIEWED_BACKFILL_MARKER,
  planFormViewedAttributionBackfill,
  type EmailLogAttribution,
  type MetricEventRow,
} from "./backfill-form-viewed-attribution"

const SESSION = "session-a"
const EMAIL_LOG = "e231d889-da04-4273-afb2-c2e82fa9a04e"
const OUTRO_EMAIL_LOG = "3fc5f0a2-1111-4222-8333-444455556666"
const CAMPAIGN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const FORM = "form-1"
const PUBLICATION = "pub-1"

const VISITA_DIRETA = new Date("2026-08-01T10:00:00.000Z")
const VISITA_CAMPANHA = new Date("2026-08-22T13:45:00.000Z")

function row(overrides: Partial<MetricEventRow> = {}): MetricEventRow {
  return {
    eventKey: `${SESSION}:form_viewed:form`,
    eventType: "form_viewed",
    visitorSessionId: SESSION,
    formId: FORM,
    publicationId: PUBLICATION,
    occurredAt: VISITA_DIRETA,
    createdAt: VISITA_DIRETA,
    origin: { source: "direct" },
    ...overrides,
  }
}

function doador(overrides: Partial<MetricEventRow> = {}): MetricEventRow {
  return row({
    eventKey: `${SESSION}:form_started:form:el:${EMAIL_LOG}`,
    eventType: "form_started",
    occurredAt: VISITA_CAMPANHA,
    createdAt: VISITA_CAMPANHA,
    origin: {
      emailLogId: EMAIL_LOG,
      campaignId: CAMPAIGN,
      recipientEmail: "destinatario@exemplo.com",
      source: "email_campaign",
    },
    ...overrides,
  })
}

describe("planFormViewedAttributionBackfill", () => {
  it("sintetiza o form_viewed atribuído a partir do form_started da mesma sessão", () => {
    const plan = planFormViewedAttributionBackfill([row(), doador()])

    expect(plan.rows).toHaveLength(1)
    const [synthesized] = plan.rows
    expect(synthesized.eventKey).toBe(`${SESSION}:form_viewed:form:el:${EMAIL_LOG}`)
    expect(synthesized.origin).toMatchObject({
      emailLogId: EMAIL_LOG,
      campaignId: CAMPAIGN,
      backfill: FORM_VIEWED_BACKFILL_MARKER,
    })
    expect(synthesized.donorEventType).toBe("form_started")
  })

  it("usa os carimbos do doador — é isso que põe a linha na janela do disparo", () => {
    const [synthesized] = planFormViewedAttributionBackfill([row(), doador()]).rows
    expect(synthesized.createdAt).toEqual(VISITA_CAMPANHA)
    expect(synthesized.occurredAt).toEqual(VISITA_CAMPANHA)
    // Não herda o createdAt da visita direta, que cairia fora do período.
    expect(synthesized.createdAt).not.toEqual(VISITA_DIRETA)
  })

  it("não mexe na linha órfã — a visita direta é preservada", () => {
    const orfa = row()
    const plan = planFormViewedAttributionBackfill([orfa, doador()])
    expect(plan.rows.every((item) => item.eventKey !== orfa.eventKey)).toBe(true)
  })

  it("é idempotente: não replaneja quando a linha atribuída já existe", () => {
    const jaAtribuida = row({
      eventKey: `${SESSION}:form_viewed:form:el:${EMAIL_LOG}`,
      origin: { emailLogId: EMAIL_LOG, campaignId: CAMPAIGN },
      createdAt: VISITA_CAMPANHA,
    })
    const plan = planFormViewedAttributionBackfill([row(), jaAtribuida, doador()])

    expect(plan.rows).toHaveLength(0)
    expect(plan.sessionsAlreadyAttributed).toContain(SESSION)
  })

  it("prefere form_started a form_completed como doador", () => {
    const completed = doador({
      eventKey: `${SESSION}:form_completed:el:${EMAIL_LOG}`,
      eventType: "form_completed",
    })
    const [synthesized] = planFormViewedAttributionBackfill([row(), completed, doador()]).rows
    expect(synthesized.donorEventType).toBe("form_started")
  })

  it("cai para form_completed quando não há form_started", () => {
    const completed = doador({
      eventKey: `${SESSION}:form_completed:el:${EMAIL_LOG}`,
      eventType: "form_completed",
    })
    const [synthesized] = planFormViewedAttributionBackfill([row(), completed]).rows
    expect(synthesized.donorEventType).toBe("form_completed")
  })

  it("gera uma linha por campanha quando o mesmo destinatário recebeu duas", () => {
    const segundoDisparo = doador({
      eventKey: `${SESSION}:form_started:form:el:${OUTRO_EMAIL_LOG}`,
      origin: { emailLogId: OUTRO_EMAIL_LOG, campaignId: "outra-campanha" },
    })
    const plan = planFormViewedAttributionBackfill([row(), doador(), segundoDisparo])

    expect(plan.rows).toHaveLength(2)
    expect(plan.rows.map((item) => item.emailLogId).sort()).toEqual(
      [EMAIL_LOG, OUTRO_EMAIL_LOG].sort(),
    )
  })

  it("não sintetiza quando não há form_viewed órfão na sessão", () => {
    const plan = planFormViewedAttributionBackfill([doador()])
    expect(plan.rows).toHaveLength(0)
    expect(plan.sessionsWithoutOrphanView).toContain(SESSION)
  })

  it("ignora sessão sem nenhum evento atribuído", () => {
    const plan = planFormViewedAttributionBackfill([row()])
    expect(plan.rows).toHaveLength(0)
    expect(plan.sessionsWithoutOrphanView).toHaveLength(0)
    expect(plan.sessionsAlreadyAttributed).toHaveLength(0)
  })

  it("ignora emailLogId que não é UUID — origin é entrada de usuário", () => {
    const forjado = doador({ origin: { emailLogId: "../../etc/passwd", campaignId: CAMPAIGN } })
    expect(planFormViewedAttributionBackfill([row(), forjado]).rows).toHaveLength(0)
  })

  it("não vaza entre sessões diferentes", () => {
    const outraSessao = row({ visitorSessionId: "session-b" })
    const plan = planFormViewedAttributionBackfill([outraSessao, doador()])
    // O doador está em session-a, que não tem órfã própria.
    expect(plan.rows).toHaveLength(0)
  })

  it("aceita question_viewed como doador — mas sem campaignId, que vem do EmailLog", () => {
    // question_viewed passa pelo track() do cliente com o cs_el da URL, mas
    // nunca recebe o enriquecimento do servidor. Regressão do dry-run de
    // produção 2026-08-24, onde 6 de 20 linhas nasciam com campaignId undefined.
    const questionViewed = doador({
      eventKey: `${SESSION}:question_viewed:q-1:el:${EMAIL_LOG}`,
      eventType: "question_viewed",
      origin: { emailLogId: EMAIL_LOG, source: "email_campaign" },
    })
    const [synthesized] = planFormViewedAttributionBackfill([row(), questionViewed]).rows

    expect(synthesized.donorEventType).toBe("question_viewed")
    expect(synthesized.origin.campaignId).toBeUndefined()
    expect(collectUnattributedEmailLogIds([synthesized])).toEqual([EMAIL_LOG])
  })

  it("prefere doador do funil a question_viewed", () => {
    const questionViewed = doador({
      eventKey: `${SESSION}:question_viewed:q-1:el:${EMAIL_LOG}`,
      eventType: "question_viewed",
      origin: { emailLogId: EMAIL_LOG },
    })
    const [synthesized] = planFormViewedAttributionBackfill([
      row(),
      questionViewed,
      doador(),
    ]).rows
    expect(synthesized.donorEventType).toBe("form_started")
  })

  it("tolera origin nulo, array ou string sem quebrar", () => {
    for (const origin of [null, undefined, [], "texto", 42]) {
      expect(() =>
        planFormViewedAttributionBackfill([row({ origin }), doador()]),
      ).not.toThrow()
    }
    expect(planFormViewedAttributionBackfill([row({ origin: null }), doador()]).rows).toHaveLength(1)
  })
})

describe("applyEmailLogAttribution", () => {
  const base = {
    eventKey: `${SESSION}:form_viewed:form:el:${EMAIL_LOG}`,
    visitorSessionId: SESSION,
    formId: FORM,
    publicationId: PUBLICATION,
    occurredAt: VISITA_CAMPANHA,
    createdAt: VISITA_CAMPANHA,
    donorEventKey: "k",
    donorEventType: "question_viewed",
    emailLogId: EMAIL_LOG,
  }

  const semCampanha = { ...base, origin: { emailLogId: EMAIL_LOG } }
  const comCampanha = { ...base, origin: { emailLogId: EMAIL_LOG, campaignId: CAMPAIGN } }

  function mapa(entry: Partial<EmailLogAttribution> = {}) {
    return new Map<string, EmailLogAttribution>([
      [
        EMAIL_LOG,
        { campaignId: CAMPAIGN, dispatchId: "disp-1", recipientEmail: "d@e.com", ...entry },
      ],
    ])
  }

  it("resolve campaignId, dispatchId e recipientEmail a partir do EmailLog", () => {
    const { rows, droppedEmailLogIds } = applyEmailLogAttribution([semCampanha], mapa())
    expect(droppedEmailLogIds).toHaveLength(0)
    expect(rows[0].origin).toMatchObject({
      campaignId: CAMPAIGN,
      dispatchId: "disp-1",
      recipientEmail: "d@e.com",
    })
  })

  it("descarta quando o EmailLog nao existe", () => {
    const { rows, droppedEmailLogIds } = applyEmailLogAttribution([semCampanha], new Map())
    expect(rows).toHaveLength(0)
    expect(droppedEmailLogIds).toEqual([EMAIL_LOG])
  })

  it("descarta quando o EmailLog nao tem campanha (transacional)", () => {
    const { rows, droppedEmailLogIds } = applyEmailLogAttribution(
      [semCampanha],
      mapa({ campaignId: null }),
    )
    expect(rows).toHaveLength(0)
    expect(droppedEmailLogIds).toEqual([EMAIL_LOG])
  })

  it("nao mexe em linha que ja tem campaignId", () => {
    const { rows } = applyEmailLogAttribution([comCampanha], new Map())
    expect(rows).toHaveLength(1)
    expect(rows[0].origin.campaignId).toBe(CAMPAIGN)
  })

  it("collectUnattributedEmailLogIds so lista o que falta e sem repetir", () => {
    expect(collectUnattributedEmailLogIds([comCampanha])).toEqual([])
    expect(collectUnattributedEmailLogIds([semCampanha, semCampanha])).toEqual([EMAIL_LOG])
  })
})
