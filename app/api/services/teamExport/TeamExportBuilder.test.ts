import { describe, expect, it } from "bun:test"
import JSZip from "jszip"
import { buildTeamExportZip, toCsv } from "./TeamExportBuilder"

const GENERATED_AT = new Date("2026-11-09T12:00:00.000Z")

describe("toCsv", () => {
  it("começa com BOM para o Excel abrir os acentos e usa o conjunto de colunas de todas as linhas", () => {
    const csv = toCsv([{ nome: "João" }, { nome: "Maria", cidade: "São Paulo" }])

    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split("\r\n")[0]).toBe("nome,cidade")
    expect(csv).toContain("João,")
    expect(csv).toContain("Maria,São Paulo")
  })

  it("datas viram ISO, objetos viram JSON e vazio fica em branco", () => {
    const csv = toCsv([{ quando: new Date("2026-01-02T03:04:05.000Z"), extra: { a: 1 }, nada: null }])

    expect(csv).toContain("2026-01-02T03:04:05.000Z")
    expect(csv).toContain('"{""a"":1}"')
    expect(csv.split("\r\n")[1]).toMatch(/,$/)
  })

  it("protege contra fórmula de planilha: texto que começa com = ou @ ganha um apóstrofo", () => {
    const csv = toCsv([{ nome: "=HYPERLINK(\"http://x\")", email: "@cmd", ok: "Maria" }])

    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'@cmd")
    expect(csv).toContain("Maria")
  })

  it("telefone com + ou - no começo não é alterado, mas + ou - seguido de texto é protegido", () => {
    const csv = toCsv([{ tel: "+55 (11) 99999-9999", neg: "-12,50", ruim: "+cmd|calc" }])

    expect(csv).toContain("+55 (11) 99999-9999")
    expect(csv).toContain("-12,50")
    expect(csv).toContain("'+cmd|calc")
  })

  it("sem linhas devolve só o BOM (arquivo vazio, sem erro)", () => {
    expect(toCsv([])).toBe("﻿")
  })
})

describe("buildTeamExportZip", () => {
  it("monta um ZIP com uma planilha por área e um LEIA-ME", async () => {
    const { zip, counts } = await buildTeamExportZip({
      teamName: "Time Saúde",
      generatedAt: GENERATED_AT,
      tables: [
        { fileName: "leads.csv", rows: [{ nome: "Maria" }, { nome: "João" }] },
        { fileName: "membros.csv", rows: [{ nome: "Ana" }] },
      ],
    })

    const loaded = await JSZip.loadAsync(zip)
    expect(Object.keys(loaded.files).sort()).toEqual(["LEIA-ME.txt", "leads.csv", "membros.csv"])
    expect(counts).toEqual({ "leads.csv": 2, "membros.csv": 1 })
  })

  it("o LEIA-ME traz o time, a data e o aviso de dados pessoais de terceiros", async () => {
    const { zip } = await buildTeamExportZip({
      teamName: "Time Saúde",
      generatedAt: GENERATED_AT,
      tables: [{ fileName: "leads.csv", rows: [{ nome: "Maria" }] }],
    })

    const readme = await (await JSZip.loadAsync(zip)).file("LEIA-ME.txt")!.async("string")

    expect(readme).toContain("Time Saúde")
    expect(readme).toContain("09/11/2026")
    expect(readme).toContain("dados pessoais")
    expect(readme).toContain("Controlador")
    expect(readme).toContain("leads.csv: 1 linha")
  })

  it("área sem dados continua no ZIP com 0 linhas", async () => {
    const { counts } = await buildTeamExportZip({
      teamName: "Time",
      generatedAt: GENERATED_AT,
      tables: [{ fileName: "tarefas.csv", rows: [] }],
    })

    expect(counts).toEqual({ "tarefas.csv": 0 })
  })
})
