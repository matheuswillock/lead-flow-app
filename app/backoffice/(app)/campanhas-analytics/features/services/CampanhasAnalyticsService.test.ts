import { afterEach, describe, expect, it } from "bun:test"
import { CampanhasAnalyticsService } from "./CampanhasAnalyticsService"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function stubFetch(handler: (url: string) => Response) {
  globalThis.fetch = (async (input: string | URL | Request) => handler(String(input))) as typeof fetch
}

describe("CampanhasAnalyticsService.exportCsv", () => {
  it("T-11.9 — monta a URL com from/to/teamIds/dataset e usa o filename do Content-Disposition", async () => {
    let requestedUrl = ""
    stubFetch((url) => {
      requestedUrl = url
      return new Response("csv-body", {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="campanhas_templates_2026-08-01_2026-08-31.csv"',
        },
      })
    })

    const service = new CampanhasAnalyticsService()
    const result = await service.exportCsv({
      from: "2026-08-01",
      to: "2026-08-31",
      teamIds: ["t1", "t2"],
      dataset: "templates",
    })

    expect(requestedUrl).toContain("/backoffice/campanhas-analytics/export.csv")
    expect(requestedUrl).toContain("from=2026-08-01")
    expect(requestedUrl).toContain("to=2026-08-31")
    expect(requestedUrl).toContain("teamIds=t1%2Ct2")
    expect(requestedUrl).toContain("dataset=templates")
    expect(result.filename).toBe("campanhas_templates_2026-08-01_2026-08-31.csv")
    expect(await result.blob.text()).toBe("csv-body")
  })

  it("propaga a mensagem de erro do backend quando a resposta é JSON de erro (400)", async () => {
    stubFetch(() =>
      Response.json(
        { isValid: false, errorMessages: ["O período não pode ultrapassar 92 dias — selecione um intervalo menor."], result: null },
        { status: 400 }
      )
    )

    const service = new CampanhasAnalyticsService()
    await expect(
      service.exportCsv({ from: "2026-01-01", to: "2026-12-31", teamIds: [], dataset: "series" })
    ).rejects.toThrow("O período não pode ultrapassar 92 dias — selecione um intervalo menor.")
  })

  it("omite teamIds da query quando nenhum time está selecionado", async () => {
    let requestedUrl = ""
    stubFetch((url) => {
      requestedUrl = url
      return new Response("csv", { status: 200, headers: { "content-type": "text/csv" } })
    })

    const service = new CampanhasAnalyticsService()
    await service.exportCsv({ from: "2026-08-01", to: "2026-08-31", teamIds: [], dataset: "forms" })

    expect(requestedUrl).not.toContain("teamIds")
  })
})

describe("CampanhasAnalyticsService.exportAllXlsx", () => {
  it("monta a URL de export-all.xlsx com from/to/teamIds (sem dataset) e usa o filename do Content-Disposition", async () => {
    let requestedUrl = ""
    stubFetch((url) => {
      requestedUrl = url
      return new Response("xlsx-body", {
        status: 200,
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": 'attachment; filename="campanhas_completo_2026-08-01_2026-08-31.xlsx"',
        },
      })
    })

    const service = new CampanhasAnalyticsService()
    const result = await service.exportAllXlsx({ from: "2026-08-01", to: "2026-08-31", teamIds: ["t1", "t2"] })

    expect(requestedUrl).toContain("/backoffice/campanhas-analytics/export-all.xlsx")
    expect(requestedUrl).not.toContain("dataset")
    expect(requestedUrl).toContain("from=2026-08-01")
    expect(requestedUrl).toContain("to=2026-08-31")
    expect(requestedUrl).toContain("teamIds=t1%2Ct2")
    expect(result.filename).toBe("campanhas_completo_2026-08-01_2026-08-31.xlsx")
    expect(await result.blob.text()).toBe("xlsx-body")
  })

  it("propaga a mensagem de erro do backend quando a resposta é JSON de erro (400, ex.: período acima de 30 dias)", async () => {
    stubFetch(() =>
      Response.json(
        { isValid: false, errorMessages: ["O export completo não pode ultrapassar 30 dias — selecione um intervalo menor."], result: null },
        { status: 400 }
      )
    )

    const service = new CampanhasAnalyticsService()
    await expect(
      service.exportAllXlsx({ from: "2026-01-01", to: "2026-03-01", teamIds: [] })
    ).rejects.toThrow("O export completo não pode ultrapassar 30 dias — selecione um intervalo menor.")
  })
})
