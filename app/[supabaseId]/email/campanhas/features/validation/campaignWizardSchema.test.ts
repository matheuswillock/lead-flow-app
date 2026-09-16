import { afterEach, describe, expect, it, setSystemTime } from "bun:test"
import {
  buildCampaignWizardSubmitSchema,
  EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB,
} from "./campaignWizardSchema"

const TEMPLATE_ID = "11111111-1111-4111-8111-111111111111"
const CONTACT_LIST_ID = "22222222-2222-4222-8222-222222222222"
const OTHER_CONTACT_LIST_ID = "33333333-3333-4333-8333-333333333333"

const ONE_HOUR_IN_MS = 60 * 60 * 1000

const inTheFuture = (offsetMs = ONE_HOUR_IN_MS) => new Date(Date.now() + offsetMs)
const inThePast = (offsetMs = ONE_HOUR_IN_MS) => new Date(Date.now() - offsetMs)

/**
 * Instante fixo para os testes de fronteira do `<=`.
 *
 * Sem congelar o relógio, o `new Date()` que o schema avalia é sempre posterior
 * ao `new Date()` montado na payload, então uma regressão de `<=` para `<`
 * continuaria passando: o teste comparava "passado por alguns micros", não
 * igualdade. Com o relógio parado os dois lados caem no mesmo instante e a
 * fronteira vira observável.
 */
const FROZEN_NOW = new Date("2026-01-01T12:00:00.000Z")

afterEach(() => {
  setSystemTime()
})

type SubmitParams = Parameters<typeof buildCampaignWizardSubmitSchema>[0]
type SubmitSchema = ReturnType<typeof buildCampaignWizardSubmitSchema>
type SubmitResult = ReturnType<SubmitSchema["safeParse"]>

/** Single list, under the limit, no split — the simplest valid wizard shape. */
const singleListParams: SubmitParams = {
  recipientCount: 500,
  hasRadarSegment: false,
  hasContactLists: true,
  needsSplit: false,
  subCampaignCount: 1,
}

function parseSubmit(params: SubmitParams, payload: Record<string, unknown> = {}): SubmitResult {
  return buildCampaignWizardSubmitSchema(params).safeParse({
    name: "Campanha",
    templateId: TEMPLATE_ID,
    contactListIds: [CONTACT_LIST_ID],
    ...payload,
  })
}

function issueMessages(result: SubmitResult): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

function issuePaths(result: SubmitResult, message: string): string[] {
  if (result.success) return []
  return result.error.issues
    .filter((issue) => issue.message === message)
    .map((issue) => issue.path.join("."))
}

describe("buildCampaignWizardSubmitSchema", () => {
  describe("agendamento sem split", () => {
    const FUTURE_REQUIRED = "Data de agendamento deve ser no futuro"

    it("aceita o envio sem data de agendamento", () => {
      const result = parseSubmit(singleListParams)
      expect(result.success).toBe(true)
    })

    it("aceita data de agendamento no futuro", () => {
      const result = parseSubmit(singleListParams, { scheduledAt: inTheFuture() })
      expect(result.success).toBe(true)
    })

    it("rejeita data de agendamento no passado", () => {
      const result = parseSubmit(singleListParams, { scheduledAt: inThePast() })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(FUTURE_REQUIRED)
      expect(issuePaths(result, FUTURE_REQUIRED)).toEqual(["scheduledAt"])
    })

    it("rejeita data de agendamento exatamente igual ao instante atual (limite é <=, não <)", () => {
      setSystemTime(FROZEN_NOW)

      const result = parseSubmit(singleListParams, { scheduledAt: new Date(FROZEN_NOW) })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(FUTURE_REQUIRED)
    })

    it("aceita data de agendamento um milissegundo à frente do instante atual", () => {
      setSystemTime(FROZEN_NOW)

      const result = parseSubmit(singleListParams, {
        scheduledAt: new Date(FROZEN_NOW.getTime() + 1),
      })
      expect(result.success).toBe(true)
    })

    it("ignora subCampaignSchedules quando não há split", () => {
      const result = parseSubmit(singleListParams, {
        scheduledAt: inTheFuture(),
        subCampaignSchedules: [{ index: 1, scheduledAt: inThePast() }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe("agendamento com split em sub-campanhas", () => {
    const ONE_DATE_PER_SUB = "Informe uma data para cada sub-campanha"
    const ALL_SUBS_IN_FUTURE = "Todas as datas de sub-campanha devem ser no futuro"

    const splitParams: SubmitParams = {
      recipientCount: 5000,
      hasRadarSegment: false,
      hasContactLists: true,
      needsSplit: true,
      subCampaignCount: 3,
    }

    it("aceita uma data futura para cada índice de 1..subCampaignCount", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inTheFuture() },
          { index: 2, scheduledAt: inTheFuture(2 * ONE_HOUR_IN_MS) },
          { index: 3, scheduledAt: inTheFuture(3 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(true)
    })

    it("rejeita quando faltam datas (menos que subCampaignCount)", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inTheFuture() },
          { index: 2, scheduledAt: inTheFuture(2 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ONE_DATE_PER_SUB)
      expect(issuePaths(result, ONE_DATE_PER_SUB)).toEqual(["subCampaignSchedules"])
    })

    it("rejeita quando sobram datas (mais que subCampaignCount)", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inTheFuture() },
          { index: 2, scheduledAt: inTheFuture(2 * ONE_HOUR_IN_MS) },
          { index: 3, scheduledAt: inTheFuture(3 * ONE_HOUR_IN_MS) },
          { index: 4, scheduledAt: inTheFuture(4 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ONE_DATE_PER_SUB)
    })

    it("rejeita quando a contagem bate mas um índice de 1..n está faltando", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inTheFuture() },
          { index: 3, scheduledAt: inTheFuture(2 * ONE_HOUR_IN_MS) },
          { index: 4, scheduledAt: inTheFuture(3 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ONE_DATE_PER_SUB)
      expect(issuePaths(result, ONE_DATE_PER_SUB)).toEqual(["subCampaignSchedules"])
    })

    it("rejeita quando qualquer data de sub-campanha está no passado", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inTheFuture() },
          { index: 2, scheduledAt: inThePast() },
          { index: 3, scheduledAt: inTheFuture(3 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ALL_SUBS_IN_FUTURE)
      expect(issuePaths(result, ALL_SUBS_IN_FUTURE)).toEqual(["subCampaignSchedules"])
    })

    it("reporta a data no passado uma única vez, mesmo com várias no passado", () => {
      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: inThePast() },
          { index: 2, scheduledAt: inThePast(2 * ONE_HOUR_IN_MS) },
          { index: 3, scheduledAt: inThePast(3 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issuePaths(result, ALL_SUBS_IN_FUTURE)).toEqual(["subCampaignSchedules"])
    })

    it("rejeita data de sub-campanha exatamente igual ao instante atual (limite é <=, não <)", () => {
      setSystemTime(FROZEN_NOW)

      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: new Date(FROZEN_NOW) },
          { index: 2, scheduledAt: new Date(FROZEN_NOW.getTime() + ONE_HOUR_IN_MS) },
          { index: 3, scheduledAt: new Date(FROZEN_NOW.getTime() + 2 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ALL_SUBS_IN_FUTURE)
    })

    it("aceita datas de sub-campanha um milissegundo à frente do instante atual", () => {
      setSystemTime(FROZEN_NOW)

      const result = parseSubmit(splitParams, {
        subCampaignSchedules: [
          { index: 1, scheduledAt: new Date(FROZEN_NOW.getTime() + 1) },
          { index: 2, scheduledAt: new Date(FROZEN_NOW.getTime() + ONE_HOUR_IN_MS) },
          { index: 3, scheduledAt: new Date(FROZEN_NOW.getTime() + 2 * ONE_HOUR_IN_MS) },
        ],
      })
      expect(result.success).toBe(true)
    })

    it("exige datas por sub-campanha quando subCampaignCount > 1 mesmo sem needsSplit", () => {
      const result = parseSubmit(
        { ...splitParams, needsSplit: false, subCampaignCount: 2 },
        { scheduledAt: inTheFuture() }
      )
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(ONE_DATE_PER_SUB)
    })
  })

  describe("limite de destinatários de segmento Radar", () => {
    const radarOnlyParams: SubmitParams = {
      recipientCount: EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB + 1,
      hasRadarSegment: true,
      hasContactLists: false,
      needsSplit: false,
      subCampaignCount: 1,
    }
    const radarPayload = { contactListIds: [], radarSegmentSlug: "email_marketable" }
    const limitMessage = `Audiência excede o limite de ${EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB} destinatários por campanha de segmento. Refine as condições ou materialize em lista de contatos`

    it("rejeita segmento Radar sozinho acima do limite", () => {
      const result = parseSubmit(radarOnlyParams, radarPayload)
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(limitMessage)
      expect(issuePaths(result, limitMessage)).toEqual(["radarSegmentSlug"])
    })

    it("aceita segmento Radar sozinho exatamente no limite", () => {
      const result = parseSubmit(
        { ...radarOnlyParams, recipientCount: EMAIL_CAMPAIGN_MAX_RECIPIENTS_PER_SUB },
        radarPayload
      )
      expect(result.success).toBe(true)
    })

    it("não aplica o limite quando há lista de contatos junto do Radar", () => {
      const result = parseSubmit(
        { ...radarOnlyParams, hasContactLists: true },
        { contactListIds: [CONTACT_LIST_ID], radarSegmentSlug: "email_marketable" }
      )
      expect(result.success).toBe(true)
    })

    it("não aplica o limite quando não há segmento Radar", () => {
      const result = parseSubmit({
        ...radarOnlyParams,
        hasRadarSegment: false,
        hasContactLists: true,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("salvar audiência como segmento Radar", () => {
    const CUSTOM_SEGMENT_ONLY =
      "Salvar como segmento só se aplica a segmentos custom com regras DSL (não a listas ou segmentos do sistema)"
    const NAME_REQUIRED = "Informe o nome do novo segmento"

    it("aceita slug custom: com nome preenchido", () => {
      const result = parseSubmit(singleListParams, {
        radarSegmentSlug: "custom:leads-quentes",
        saveAsRadarSegment: true,
        saveAsRadarSegmentName: "Leads quentes",
      })
      expect(result.success).toBe(true)
    })

    it("rejeita quando o segmento não é custom:", () => {
      const result = parseSubmit(singleListParams, {
        radarSegmentSlug: "email_marketable",
        saveAsRadarSegment: true,
        saveAsRadarSegmentName: "Leads quentes",
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(CUSTOM_SEGMENT_ONLY)
      expect(issuePaths(result, CUSTOM_SEGMENT_ONLY)).toEqual(["saveAsRadarSegment"])
    })

    it("rejeita quando não há segmento Radar selecionado", () => {
      const result = parseSubmit(singleListParams, {
        saveAsRadarSegment: true,
        saveAsRadarSegmentName: "Leads quentes",
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(CUSTOM_SEGMENT_ONLY)
    })

    it("rejeita quando o nome do segmento está ausente", () => {
      const result = parseSubmit(singleListParams, {
        radarSegmentSlug: "custom:leads-quentes",
        saveAsRadarSegment: true,
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(NAME_REQUIRED)
      expect(issuePaths(result, NAME_REQUIRED)).toEqual(["saveAsRadarSegmentName"])
    })

    it("rejeita quando o nome do segmento é só espaço em branco", () => {
      const result = parseSubmit(singleListParams, {
        radarSegmentSlug: "custom:leads-quentes",
        saveAsRadarSegment: true,
        saveAsRadarSegmentName: "   ",
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(NAME_REQUIRED)
    })

    it("não valida slug nem nome quando saveAsRadarSegment é falso", () => {
      const result = parseSubmit(singleListParams, {
        radarSegmentSlug: "email_marketable",
        saveAsRadarSegment: false,
      })
      expect(result.success).toBe(true)
    })
  })

  describe("delegação para campaignWizardAudienciaSchema", () => {
    it("rejeita quando nenhuma fonte de audiência foi selecionada", () => {
      const noAudienceParams: SubmitParams = {
        ...singleListParams,
        hasContactLists: false,
      }
      const result = parseSubmit(noAudienceParams, { contactListIds: [] })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(
        "Selecione ao menos uma lista de contatos ou um segmento Radar"
      )
    })

    it("rejeita estratégia per_list combinada com segmento Radar", () => {
      const result = parseSubmit(
        { ...singleListParams, hasRadarSegment: true },
        {
          contactListIds: [CONTACT_LIST_ID, OTHER_CONTACT_LIST_ID],
          listStrategy: "per_list",
          radarSegmentSlug: "email_marketable",
        }
      )
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain(
        "Estratégia por lista não é compatível com segmento Radar. Use juntar listas"
      )
    })

    it("rejeita múltiplas listas sem estratégia definida", () => {
      const result = parseSubmit(singleListParams, {
        contactListIds: [CONTACT_LIST_ID, OTHER_CONTACT_LIST_ID],
      })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain("Defina como as listas serão usadas")
    })

    it("aceita per_list quando não há segmento Radar", () => {
      const result = parseSubmit(singleListParams, {
        contactListIds: [CONTACT_LIST_ID, OTHER_CONTACT_LIST_ID],
        listStrategy: "per_list",
      })
      expect(result.success).toBe(true)
    })
  })

  describe("campos base", () => {
    it("rejeita nome vazio", () => {
      const result = parseSubmit(singleListParams, { name: "   " })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain("Nome da campanha é obrigatório")
    })

    it("rejeita templateId que não é uuid", () => {
      const result = parseSubmit(singleListParams, { templateId: "nao-e-uuid" })
      expect(result.success).toBe(false)
      expect(issueMessages(result)).toContain("Selecione um template válido")
    })
  })
})
