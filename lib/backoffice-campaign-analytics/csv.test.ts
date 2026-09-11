import { describe, expect, it } from "bun:test"
import { buildCampaignAnalyticsCsv, formatCsvRate } from "./csv"

describe("buildCampaignAnalyticsCsv", () => {
  it("DA4/D5 — BOM UTF-8, separador ';', header PT-BR", () => {
    const csv = buildCampaignAnalyticsCsv(["Time", "Enviados"], [["Liber", "1623"]])
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv).toContain("Time;Enviados")
    expect(csv).toContain("Liber;1623")
  })

  it("escapa células com ';', aspas ou quebra de linha", () => {
    const csv = buildCampaignAnalyticsCsv(["Nome"], [['Time "A"; especial']])
    expect(csv).toContain('"Time ""A""; especial"')
  })

  it("gera uma linha por registro, terminando em CRLF", () => {
    const csv = buildCampaignAnalyticsCsv(["A", "B"], [["1", "2"], ["3", "4"]])
    const lines = csv.replace("﻿", "").split("\r\n").filter(Boolean)
    expect(lines).toEqual(["A;B", "1;2", "3;4"])
  })
})

describe("formatCsvRate", () => {
  it("formata como percentual com vírgula decimal", () => {
    expect(formatCsvRate(0.126)).toBe("12,6%")
  })

  it("null vira célula vazia, nunca 0%", () => {
    expect(formatCsvRate(null)).toBe("")
  })
})
