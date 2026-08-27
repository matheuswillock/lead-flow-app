import { describe, expect, it } from "bun:test"
import { buildSenderErrorMessage } from "./EmailSettingsHook"

describe("buildSenderErrorMessage", () => {
  it("mostra mensagem específica para remetente fora do domínio cadastrado", () => {
    const result = buildSenderErrorMessage(
      new Error("O e-mail do remetente deve usar o domínio cadastrado (@mail.libercorretora.com.br)"),
      "mail.libercorretora.com.br"
    )

    expect(result).toBe(
      "Não foi possível cadastrar o remetente porque ele não possui o domínio cadastrado. Use um e-mail com o domínio cadastrado (@mail.libercorretora.com.br)."
    )
  })
})
