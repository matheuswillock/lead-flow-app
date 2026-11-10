import { describe, expect, it } from "bun:test"
import { CnpjService } from "./CnpjService"

function fetcherReturning(body: unknown, ok = true): typeof fetch {
  return (async () => ({ ok, json: async () => body })) as unknown as typeof fetch
}

describe("CnpjService.consultar", () => {
  it("devolve razão social e nome fantasia da consulta", async () => {
    const result = await CnpjService.consultar(
      "11.222.333/0001-81",
      fetcherReturning({ razao_social: " CORRETORA EXEMPLO LTDA ", nome_fantasia: "Exemplo Seguros" }),
    )
    expect(result).toEqual({ legalName: "CORRETORA EXEMPLO LTDA", tradeName: "Exemplo Seguros" })
  })

  it("nome fantasia vazio vira null", async () => {
    const result = await CnpjService.consultar(
      "11222333000181",
      fetcherReturning({ razao_social: "EXEMPLO LTDA", nome_fantasia: "" }),
    )
    expect(result).toEqual({ legalName: "EXEMPLO LTDA", tradeName: null })
  })

  it("CNPJ incompleto, resposta de erro ou falha de rede devolvem null", async () => {
    expect(await CnpjService.consultar("123", fetcherReturning({}))).toBeNull()
    expect(await CnpjService.consultar("11222333000181", fetcherReturning({}, false))).toBeNull()
    expect(await CnpjService.consultar("11222333000181", fetcherReturning({ razao_social: null }))).toBeNull()
    const failing = (async () => {
      throw new Error("offline")
    }) as unknown as typeof fetch
    expect(await CnpjService.consultar("11222333000181", failing)).toBeNull()
  })
})
