import { describe, expect, test } from "bun:test"
import { NextResponse } from "next/server"
import { createAccountWriteGuard, shouldGuardAccountWrite } from "./account-write-guard"

// O caminho recebido é o recurso da API, já sem a base (ex.: "leads/lead-1/status").
describe("shouldGuardAccountWrite", () => {
  test("cobre toda escrita em leads e carteira, inclusive subrotas", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(shouldGuardAccountWrite("leads", method)).toBe(true)
      expect(shouldGuardAccountWrite("leads/lead-1", method)).toBe(true)
      expect(shouldGuardAccountWrite("leads/lead-1/status", method)).toBe(true)
      expect(shouldGuardAccountWrite("leads/import/mapped", method)).toBe(true)
      expect(shouldGuardAccountWrite("portfolio", method)).toBe(true)
      expect(shouldGuardAccountWrite("portfolio/lead-1/detail", method)).toBe(true)
    }
  })

  test("aceita o método em qualquer caixa", () => {
    expect(shouldGuardAccountWrite("leads", "post")).toBe(true)
    expect(shouldGuardAccountWrite("leads", "Delete")).toBe(true)
  })

  test("deixa as leituras passarem", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(shouldGuardAccountWrite("leads", method)).toBe(false)
      expect(shouldGuardAccountWrite("leads/lead-1", method)).toBe(false)
      expect(shouldGuardAccountWrite("portfolio", method)).toBe(false)
    }
  })

  test("não alcança outras áreas nem rotas de nome parecido", () => {
    for (const path of [
      "billing-grace-payment",
      "public-forms/abc",
      "me",
      "leadsx",
      "leads-export",
      "portfolios",
      "x/leads",
      "",
    ]) {
      expect(shouldGuardAccountWrite(path, "POST")).toBe(false)
    }
  })
})

describe("createAccountWriteGuard", () => {
  const denied = () =>
    NextResponse.json({ error: "Acesso somente leitura" }, { status: 403 })

  test("devolve a resposta de bloqueio quando a conta não pode gravar", async () => {
    const guard = createAccountWriteGuard(async () => denied())

    const response = await guard("supabase-1")

    expect(response?.status).toBe(403)
  })

  test("deixa a requisição seguir quando a conta pode gravar", async () => {
    const guard = createAccountWriteGuard(async () => null)

    expect(await guard("supabase-1")).toBeNull()
  })

  test("falha fechado com 503 se a consulta de acesso quebrar", async () => {
    const guard = createAccountWriteGuard(async () => {
      throw new Error("banco indisponível")
    })

    const response = await guard("supabase-1")

    expect(response?.status).toBe(503)
  })
})
