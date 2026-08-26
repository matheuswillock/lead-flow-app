import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * SPEC 40 E0 / todo 23 — o ranking "top convertendo" da home lia os eventos
 * fabricados pelo cron de despacho.
 *
 * O efeito era perverso: o formulário que o cron mais completou sozinho subia no
 * ranking como se convertesse melhor. Este teste trava o corte com números —
 * mesmo formulário, mesma sessão vista, e a conclusão fabricada não conta.
 */

const formFindMany = mock(async () => [
  { id: "form-1", name: "Lista Fria" },
  { id: "form-2", name: "Formulário Padrão" },
])
const metricFindMany = mock(async (_args: unknown) => [] as unknown[])

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicForm: { findMany: formFindMany },
    publicFormMetricEvent: { findMany: metricFindMany },
  },
}))

const { PublicFormsRepository } = await import("./PublicFormsRepository")

function evento(
  formId: string,
  eventType: string,
  visitorSessionId: string,
  origin: unknown = {},
) {
  return { formId, eventType, visitorSessionId, origin }
}

describe("listFormConversionTotals — fabricadas fora do ranking", () => {
  beforeEach(() => {
    formFindMany.mockClear()
    metricFindMany.mockClear()
  })

  it("não conta o form_completed marcado como fabricado", async () => {
    metricFindMany.mockImplementation(async () => [
      evento("form-1", "form_viewed", "s1"),
      evento("form-1", "form_viewed", "s2"),
      // Só a s1 enviou de verdade; a s2 foi completada pelo cron.
      evento("form-1", "form_completed", "s1"),
      evento("form-1", "form_completed", "s2", { fabricatedByDispatcher: true }),
    ])

    const [listaFria] = await new PublicFormsRepository().listFormConversionTotals("team-1")

    expect(listaFria.viewed).toBe(2)
    expect(listaFria.completed).toBe(1)
  })

  it("a visita da sessão fabricada continua contando — quem viu foi gente real", async () => {
    metricFindMany.mockImplementation(async () => [
      // O `form_viewed` NÃO é marcado pela migration de propósito: a pessoa
      // abriu o formulário. Fabricado é o desfecho, não a visita.
      evento("form-1", "form_viewed", "s2"),
      evento("form-1", "form_completed", "s2", { fabricatedByDispatcher: true }),
    ])

    const [listaFria] = await new PublicFormsRepository().listFormConversionTotals("team-1")

    expect(listaFria.viewed).toBe(1)
    expect(listaFria.completed).toBe(0)
  })

  it("sem nenhuma marca, os números são os de antes — o corte não muda o caso limpo", async () => {
    metricFindMany.mockImplementation(async () => [
      evento("form-2", "form_viewed", "s3"),
      evento("form-2", "form_completed", "s3"),
    ])

    const totais = await new PublicFormsRepository().listFormConversionTotals("team-1")
    const padrao = totais.find((item) => item.formId === "form-2")

    expect(padrao?.viewed).toBe(1)
    expect(padrao?.completed).toBe(1)
  })

  it("carrega o origin na consulta — sem ele o corte não teria como acontecer", async () => {
    await new PublicFormsRepository().listFormConversionTotals("team-1")

    const args = metricFindMany.mock.calls[0]?.[0] as unknown as {
      select: Record<string, boolean>
    }
    expect(args.select.origin).toBe(true)
  })
})
