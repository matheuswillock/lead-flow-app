import { describe, expect, it } from "bun:test"
import * as XLSX from "xlsx"
import { BackofficeCampaignAnalyticsExportAllService } from "./BackofficeCampaignAnalyticsExportAllService"

describe("BackofficeCampaignAnalyticsExportAllService.buildWorkbook", () => {
  it("gera uma aba por tabela, na mesma ordem recebida, com o filename informado", () => {
    const service = new BackofficeCampaignAnalyticsExportAllService()
    const result = service.buildWorkbook({
      filename: "campanhas_completo_2026-08-01_2026-08-30.xlsx",
      sheets: [
        { name: "Resumo", headers: ["Métrica", "Valor"], rows: [["Disparos", "40"]] },
        { name: "Disparos", headers: ["Time"], rows: [["Liber"]] },
      ],
    })

    expect(result.filename).toBe("campanhas_completo_2026-08-01_2026-08-30.xlsx")

    const workbook = XLSX.read(result.buffer, { type: "array" })
    expect(workbook.SheetNames).toEqual(["Resumo", "Disparos"])

    const resumo = XLSX.utils.sheet_to_json(workbook.Sheets.Resumo, { header: 1 })
    expect(resumo).toEqual([["Métrica", "Valor"], ["Disparos", "40"]])
  })

  it("prefixa célula que começaria com '=', '+', '-' ou '@' para neutralizar fórmula (proteção contra CSV/XLSX injection)", () => {
    const service = new BackofficeCampaignAnalyticsExportAllService()
    const result = service.buildWorkbook({
      filename: "x.xlsx",
      sheets: [
        {
          name: "Disparos",
          headers: ["Time", "Erro"],
          rows: [["=SUM(A1:A9)", "+cmd|' /C calc'!A0"]],
        },
      ],
    })

    const workbook = XLSX.read(result.buffer, { type: "array" })
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Disparos, { header: 1 })
    expect((rows[1] as string[])[0]).toBe("'=SUM(A1:A9)")
    expect((rows[1] as string[])[1]).toBe("'+cmd|' /C calc'!A0")
  })

  it("não escapa célula que não começa com caractere de fórmula", () => {
    const service = new BackofficeCampaignAnalyticsExportAllService()
    const result = service.buildWorkbook({
      filename: "x.xlsx",
      sheets: [{ name: "Templates", headers: ["Time"], rows: [["Liber Corretora"]] }],
    })

    const workbook = XLSX.read(result.buffer, { type: "array" })
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Templates, { header: 1 })
    expect((rows[1] as string[])[0]).toBe("Liber Corretora")
  })
})
