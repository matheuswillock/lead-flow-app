import { describe, expect, it } from "bun:test"
import {
  buildUnsubscribeLinkEmailSnippet,
  EMAIL_UNSUBSCRIBE_LINK_TOKEN,
  templateIncludesManualUnsubscribeLink,
} from "./unsubscribe-link-embed"

describe("unsubscribe-link-embed", () => {
  it("detecta variável de descadastro no template", () => {
    expect(templateIncludesManualUnsubscribeLink("Clique em {{ link_descadastro }}")).toBe(true)
    expect(templateIncludesManualUnsubscribeLink("<p>Sem link manual</p>")).toBe(false)
  })

  it("gera snippet HTML com token de descadastro", () => {
    const snippet = buildUnsubscribeLinkEmailSnippet({
      ctaLabel: 'Descadastrar <agora>',
    })
    expect(snippet).toContain(EMAIL_UNSUBSCRIBE_LINK_TOKEN)
    expect(snippet).toContain("Descadastrar &lt;agora&gt;")
    expect(snippet).toContain('href="{{link_descadastro}}"')
  })
})
