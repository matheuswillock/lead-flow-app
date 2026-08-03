import { describe, expect, test } from "bun:test"
import { autoMapRadarColumns } from "./autoMapRadarColumns"

describe("autoMapRadarColumns", () => {
  test("mapeia colunas comuns de nome, telefone e e-mail", () => {
    const mapping = autoMapRadarColumns(["Nome", "Telefone", "E-mail", "Plano Atual"])
    expect(mapping.name).toBe("Nome")
    expect(mapping.phone).toBe("Telefone")
    expect(mapping.email).toBe("E-mail")
    expect(mapping["Plano Atual"]).toBeUndefined()
  })

  test("não reutiliza a mesma coluna em dois campos", () => {
    const mapping = autoMapRadarColumns(["nome", "email"])
    expect(Object.values(mapping).filter((column) => column === "nome")).toHaveLength(1)
  })
})
