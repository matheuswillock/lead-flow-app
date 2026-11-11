import { describe, expect, it } from "bun:test"
import { STUDIO_ACTIVITY_AUTHOR } from "@/lib/studio-feed-identity"
import { formatActivityAuthorName } from "./formatActivityAuthorName"

describe("formatActivityAuthorName", () => {
  it("marca a equipe Corretor Studio como suporte", () => {
    expect(
      formatActivityAuthorName({ fullName: "Joana Silva", email: "joana@corretorstudio.com.br" })
    ).toBe("Joana Silva · Equipe de suporte")
  })

  it("sem nome, usa o e-mail e mantém a marca de suporte", () => {
    expect(formatActivityAuthorName({ fullName: null, email: "Joana@CorretorStudio.com.br" })).toBe(
      "Joana@CorretorStudio.com.br · Equipe de suporte"
    )
  })

  it("não marca quem é do cliente", () => {
    expect(formatActivityAuthorName({ fullName: "Marina", email: "marina@horizonte.com.br" })).toBe("Marina")
    expect(formatActivityAuthorName({ fullName: null, email: "marina@horizonte.com.br" })).toBe(
      "marina@horizonte.com.br"
    )
  })

  it("não confunde domínios parecidos com a equipe", () => {
    expect(
      formatActivityAuthorName({ fullName: "Falso", email: "falso@corretorstudio.com.br.evil.com" })
    ).toBe("Falso")
    expect(formatActivityAuthorName({ fullName: "Sub", email: "sub@mail.corretorstudio.com.br" })).toBe("Sub")
  })

  it("o autor do sistema (Corretor Studio) não vira suporte", () => {
    expect(formatActivityAuthorName(STUDIO_ACTIVITY_AUTHOR)).toBe("Corretor Studio")
  })

  it("sem autor, usa o texto padrão ou o informado", () => {
    expect(formatActivityAuthorName(null)).toBe("Sistema")
    expect(formatActivityAuthorName(undefined, "—")).toBe("—")
    expect(formatActivityAuthorName({ fullName: " ", email: "" })).toBe("Sistema")
  })
})
