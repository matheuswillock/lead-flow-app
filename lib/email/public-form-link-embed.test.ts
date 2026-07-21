import { describe, expect, it } from "bun:test"
import { buildPublicFormLinkEmailSnippet } from "./public-form-link-embed"

describe("buildPublicFormLinkEmailSnippet", () => {
  it("gera CTA com nome e URL escapados", () => {
    const snippet = buildPublicFormLinkEmailSnippet({
      formName: 'Plano <PME> & "VIP"',
      formUrl: "https://app.example.com/forms/abc123",
      ctaLabel: "Quero participar",
    })
    expect(snippet).toContain("Plano &lt;PME&gt; &amp; &quot;VIP&quot;")
    expect(snippet).toContain('href="https://app.example.com/forms/abc123"')
    expect(snippet).toContain("Quero participar")
  })
})
