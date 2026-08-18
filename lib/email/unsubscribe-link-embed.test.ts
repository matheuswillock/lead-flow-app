import { describe, expect, it } from "bun:test"
import {
  buildUnsubscribeLinkEmailSnippet,
  EMAIL_UNSUBSCRIBE_LINK_TOKEN,
  isEmailUnsubscribeLinkVariableKey,
  normalizeUnsubscribeLookalikeTokens,
  suggestUnsubscribeTokenHint,
  templateIncludesManualUnsubscribeLink,
} from "./unsubscribe-link-embed"

describe("unsubscribe-link-embed", () => {
  it("detecta variável nativa e aliases de descadastro no template", () => {
    expect(templateIncludesManualUnsubscribeLink("Clique em {{ link_descadastro }}")).toBe(true)
    expect(templateIncludesManualUnsubscribeLink('href="{{unsubscribe_url}}"')).toBe(true)
    expect(templateIncludesManualUnsubscribeLink("{{ unsubscribe_link }}")).toBe(true)
    expect(templateIncludesManualUnsubscribeLink("<p>Sem link manual</p>")).toBe(false)
    expect(templateIncludesManualUnsubscribeLink("{{opt_out_link}}")).toBe(false)
  })

  it("reconhece chaves nativa e aliases", () => {
    expect(isEmailUnsubscribeLinkVariableKey("link_descadastro")).toBe(true)
    expect(isEmailUnsubscribeLinkVariableKey("Unsubscribe_URL")).toBe(true)
    expect(isEmailUnsubscribeLinkVariableKey("unsubscribe_link")).toBe(true)
    expect(isEmailUnsubscribeLinkVariableKey("opt_out_link")).toBe(false)
  })

  it("reescreve aliases para o token nativo", () => {
    expect(normalizeUnsubscribeLookalikeTokens('href="{{unsubscribe_url}}"')).toBe(
      'href="{{link_descadastro}}"'
    )
    expect(normalizeUnsubscribeLookalikeTokens("{{ unsubscribe_link }} e {{link_descadastro}}")).toBe(
      "{{link_descadastro}} e {{link_descadastro}}"
    )
  })

  it("não sugere hint para aliases já reconhecidos; sugere para lookalike custom", () => {
    expect(suggestUnsubscribeTokenHint(["unsubscribe_url"])).toBeNull()
    expect(suggestUnsubscribeTokenHint(["opt_out_link"])).toContain("{{link_descadastro}}")
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
