import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { AccountAccessGate } from "./AccountAccessGate"

test("não renderiza sidebar, header ou conteúdo da plataforma para conta restrita", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate decision={{ state: "restricted", reason: "past_due" }}>
      <aside data-testid="sidebar">sidebar</aside>
      <header data-testid="header">header</header>
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("Seu acesso está pausado")
  expect(markup).not.toContain("data-testid=\"sidebar\"")
  expect(markup).not.toContain("data-testid=\"header\"")
  expect(markup).not.toContain("dados financeiros e CRM")
  expect(markup).toContain("w-full max-w-md")
  expect(markup).toContain("p-4")
})
