import { describe, expect, it } from "bun:test"
import { denyIfSupportAccess } from "./denyIfSupportAccess"

describe("denyIfSupportAccess", () => {
  it("nega a ação para a equipe de suporte com 403", async () => {
    const response = denyIfSupportAccess({ isSupportAccess: true }, "exportar dados")

    expect(response?.status).toBe(403)
    const body = await response?.json()
    expect(body.isValid).toBe(false)
    expect(body.errorMessages[0]).toContain("exportar dados")
  })

  it("não interfere com usuários comuns", () => {
    expect(denyIfSupportAccess({ isSupportAccess: false }, "exportar dados")).toBeNull()
    expect(denyIfSupportAccess({}, "exportar dados")).toBeNull()
  })
})
