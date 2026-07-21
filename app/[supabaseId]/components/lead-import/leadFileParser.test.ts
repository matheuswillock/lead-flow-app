import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseLeadFile } from "./leadFileParser"

describe("parseLeadFile — CSV", () => {
  it("parseia CSV com cabeçalho e campos entre aspas", async () => {
    const content = readFileSync(
      join(
        process.cwd(),
        "lib/emailContactImport/fixtures/emails-invalidos-teste-import.csv"
      ),
      "utf8"
    )
    const file = new File([content], "emails-invalidos-teste-import.csv", {
      type: "text/csv",
    })

    const parsed = await parseLeadFile(file)

    expect(parsed.columns).toEqual(["email", "nome"])
    expect(parsed.rows.length).toBeGreaterThan(10)
    expect(parsed.rows[0]?.values.email).toBe(
      "carol.ocipriani@gmail.com|hugopoli@gmail.com"
    )
    expect(
      parsed.rows.some((row) => row.values.email === "a@b.com,c@d.com")
    ).toBe(true)
  })

  it("rejeita extensão não suportada", async () => {
    const file = new File(["a,b\n1,2"], "dados.txt", { type: "text/plain" })
    await expect(parseLeadFile(file)).rejects.toThrow(/Formato não suportado/)
  })
})
