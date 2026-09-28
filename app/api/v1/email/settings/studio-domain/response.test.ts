import { describe, expect, test } from "bun:test"
import { Output } from "@/lib/output"
import { studioDomainOutputStatus } from "./response"

describe("studioDomainOutputStatus", () => {
  test("retorna 200 para uma resposta válida", () => {
    expect(studioDomainOutputStatus(new Output(true, [], [], null))).toBe(200)
  })

  test("mantém 403 somente para acesso negado", () => {
    expect(studioDomainOutputStatus(new Output(false, [], ["Acesso negado"], null))).toBe(403)
  })

  test("retorna 500 para falha de provisionamento", () => {
    expect(
      studioDomainOutputStatus(
        new Output(false, [], ["Não foi possível registrar o subdomínio studio agora."], null),
      ),
    ).toBe(500)
  })

  test("retorna 500 quando a integração de domínio não está configurada", () => {
    expect(
      studioDomainOutputStatus(new Output(false, [], ["Integração de domínio não configurada."], null)),
    ).toBe(500)
  })
})
