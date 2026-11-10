import { describe, expect, it } from "bun:test"
import {
  EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER,
  isCorretorStudioStaffEmail,
} from "./email-domain"

describe("isCorretorStudioStaffEmail", () => {
  it("reconhece e-mail da equipe, ignorando caixa e espaços", () => {
    expect(isCorretorStudioStaffEmail("nathiele@corretorstudio.com.br")).toBe(true)
    expect(isCorretorStudioStaffEmail("  Joao@CorretorStudio.com.br ")).toBe(true)
  })

  it("não confunde outros domínios com a equipe", () => {
    expect(isCorretorStudioStaffEmail("cliente@gmail.com")).toBe(false)
    expect(isCorretorStudioStaffEmail("x@corretorstudio.com.br.evil.com")).toBe(false)
    expect(isCorretorStudioStaffEmail("x@mail.corretorstudio.com.br")).toBe(false)
    expect(isCorretorStudioStaffEmail(null)).toBe(false)
    expect(isCorretorStudioStaffEmail(undefined)).toBe(false)
  })
})

describe("EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER", () => {
  it("nega e-mails que terminam com o domínio da equipe, sem diferenciar caixa", () => {
    expect(EXCLUDE_CORRETOR_STUDIO_STAFF_PROFILE_FILTER).toEqual({
      NOT: { email: { endsWith: "@corretorstudio.com.br", mode: "insensitive" } },
    })
  })
})
