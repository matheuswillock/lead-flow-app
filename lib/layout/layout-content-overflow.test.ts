import { describe, expect, test } from "bun:test"
import { shouldContainLayoutContent } from "./layout-content-overflow"

describe("shouldContainLayoutContent", () => {
  test("contém o shell nas rotas internas do editor de formulários", () => {
    expect(shouldContainLayoutContent("/user-1/forms/form-1")).toBe(true)
    expect(shouldContainLayoutContent("/user-1/forms/new")).toBe(true)
  })

  test("mantém o scroll do shell nas páginas de listagem", () => {
    expect(shouldContainLayoutContent("/user-1/forms")).toBe(false)
    expect(shouldContainLayoutContent("/user-1/dashboard")).toBe(false)
  })
})
