import { describe, expect, it } from "bun:test"
import {
  buildMetricEventWhereSql,
  isFabricatedByDispatcher,
} from "./MetricEventAggregationSql"

/**
 * SPEC 40 E0 / todo 23 — as conclusões que o cron de despacho inventou não
 * podem entrar em contagem de funil.
 *
 * Medido em produção em 25/08: 311 submissões fabricadas entre 30/07 e 25/08
 * faziam o painel mostrar 21,5% de conversão (413 completados / 89 com lead)
 * quando a taxa real é 75,7% (103 / 78). O produto parecia 3,5× pior do que é.
 *
 * Os dois caminhos de leitura — SQL cru na agregação e Prisma Client no ranking
 * — precisam aplicar o MESMO corte. Divergir daria números diferentes para a
 * mesma pergunta na mesma tela, que é pior que o bug original: dois painéis
 * discordando não têm como ser conferidos.
 */

const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

describe("buildMetricEventWhereSql — corte das fabricadas", () => {
  it("todo filtro carrega o predicado, mesmo o mais simples", () => {
    const sql = buildMetricEventWhereSql({ formId: FORM_ID }).sql

    expect(sql).toContain("fabricatedByDispatcher")
    // `IS NULL`, não `= false`: linha não marcada não tem a chave. Comparar com
    // `false` não casaria com ela e o funil viria vazio.
    expect(sql).toContain("IS NULL")
  })

  it("continua carregando o predicado com publicação e período", () => {
    const sql = buildMetricEventWhereSql({
      formId: FORM_ID,
      publicationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-31T23:59:59Z"),
    }).sql

    expect(sql).toContain("fabricatedByDispatcher")
  })
})

describe("isFabricatedByDispatcher — espelho JS do predicado", () => {
  it("marca só quando a flag é exatamente true", () => {
    expect(isFabricatedByDispatcher({ fabricatedByDispatcher: true })).toBe(true)
  })

  it("origem sem a chave não é fabricada — é o caso da esmagadora maioria", () => {
    expect(isFabricatedByDispatcher({})).toBe(false)
    expect(isFabricatedByDispatcher({ campaignId: "abc" })).toBe(false)
  })

  it("null, undefined e array não quebram nem contam como fabricada", () => {
    expect(isFabricatedByDispatcher(null)).toBe(false)
    expect(isFabricatedByDispatcher(undefined)).toBe(false)
    expect(isFabricatedByDispatcher([])).toBe(false)
    expect(isFabricatedByDispatcher("true")).toBe(false)
  })

  it("valor falsy ou string não conta — a marca é booleana", () => {
    expect(isFabricatedByDispatcher({ fabricatedByDispatcher: false })).toBe(false)
    // `origin` vem de JSON de terceiro; string "true" não pode virar exclusão.
    expect(isFabricatedByDispatcher({ fabricatedByDispatcher: "true" })).toBe(false)
  })
})
