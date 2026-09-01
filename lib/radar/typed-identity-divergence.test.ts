import { describe, expect, it } from "bun:test"
import { isTypedIdentityDivergentFromLead } from "./typed-identity-divergence"

// Caso real de produção (31/08): o Alexandre respondeu pelo link do próprio
// e-mail e caiu no card "vladicea", vinculado ao perfil dele desde 11/08.
const alexandre = {
  name: "Alexandre",
  phone: "(13) 99788-9618",
  email: "alexandre@libercorretora.com.br",
}
const vladicea = {
  name: "vladicea",
  phone: "(11) 94072-9650",
  email: "diretoria@libercorretora.com.br",
}

describe("isTypedIdentityDivergentFromLead", () => {
  it("acusa divergência quando telefone e e-mail digitados diferem do lead", () => {
    expect(isTypedIdentityDivergentFromLead(alexandre, vladicea)).toBe(true)
  })

  it("não acusa divergência quando o telefone digitado bate com o lead", () => {
    expect(
      isTypedIdentityDivergentFromLead(
        { ...alexandre, phone: "5511940729650" },
        vladicea,
      ),
    ).toBe(false)
  })

  it("não acusa divergência quando o e-mail digitado bate com o lead", () => {
    expect(
      isTypedIdentityDivergentFromLead(
        { ...alexandre, email: "DIRETORIA@libercorretora.com.br" },
        vladicea,
      ),
    ).toBe(false)
  })

  it("não acusa divergência com identidade digitada incompleta", () => {
    expect(isTypedIdentityDivergentFromLead({ ...alexandre, email: null }, vladicea)).toBe(false)
    expect(isTypedIdentityDivergentFromLead({ ...alexandre, phone: null }, vladicea)).toBe(false)
    expect(isTypedIdentityDivergentFromLead({ ...alexandre, phone: "999" }, vladicea)).toBe(false)
  })

  it("não acusa divergência quando o lead não tem telefone nem e-mail", () => {
    expect(
      isTypedIdentityDivergentFromLead(alexandre, { name: "Sem contato", phone: null, email: null }),
    ).toBe(false)
  })

  it("compara telefone pelo sufixo comum (DDI e fixo de 10 dígitos)", () => {
    expect(
      isTypedIdentityDivergentFromLead(
        { ...alexandre, phone: "+55 (11) 3897-1122" },
        { ...vladicea, phone: "1138971122" },
      ),
    ).toBe(false)
  })

  it("nome divergente sozinho não parte o card", () => {
    expect(
      isTypedIdentityDivergentFromLead(
        { name: "Outra pessoa", phone: vladicea.phone, email: vladicea.email },
        vladicea,
      ),
    ).toBe(false)
  })
})
