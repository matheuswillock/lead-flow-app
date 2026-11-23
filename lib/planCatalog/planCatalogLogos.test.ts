import { describe, expect, it } from "bun:test"
import { extractLogodbFromPrototype, planLogoFiles } from "./planCatalogLogos"
import { assertImportTarget } from "./importTarget"

const svg = Buffer.from("<svg/>").toString("base64")

describe("planLogoFiles", () => {
  it("converte data URI SVG em arquivo estático", () => {
    const { files, errors } = planLogoFiles({ "Porto Seguro": `data:image/svg+xml;base64,${svg}` })
    expect(errors).toEqual([])
    expect(files).toEqual([{ path: "/operadoras/porto-seguro.svg", content: Buffer.from("<svg/>") }])
  })

  it("recusa tipo de imagem que não é SVG", () => {
    const { files, errors } = planLogoFiles({ Amil: `data:image/png;base64,${svg}` })
    expect(files).toHaveLength(0)
    expect(errors[0]).toContain("esperado image/svg+xml")
  })
})

describe("extractLogodbFromPrototype", () => {
  it("lê o bloco logodb do HTML do protótipo", () => {
    const html = `<script type="application/json" id="logodb">{"Amil":"data:image/svg+xml;base64,${svg}"}</script>`
    expect(Object.keys(extractLogodbFromPrototype(html))).toEqual(["Amil"])
  })

  it("falha quando o bloco não existe", () => {
    expect(() => extractLogodbFromPrototype("<html></html>")).toThrow("sem <script id=\"logodb\">")
  })
})

describe("assertImportTarget", () => {
  it("aceita quando o host confirmado bate com DATABASE_URL", () => {
    expect(assertImportTarget("postgresql://u:p@db.exemplo.com:5432/x", "db.exemplo.com")).toEqual({ host: "db.exemplo.com" })
  })

  it("recusa host diferente", () => {
    expect(() => assertImportTarget("postgresql://u:p@localhost:5432/x", "db.exemplo.com")).toThrow("diferente")
  })

  it("recusa sem --confirm-host", () => {
    expect(() => assertImportTarget("postgresql://u:p@localhost:5432/x", undefined)).toThrow("--confirm-host")
  })
})
