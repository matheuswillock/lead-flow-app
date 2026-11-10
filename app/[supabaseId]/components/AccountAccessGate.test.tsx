import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { AccountAccessGate } from "./AccountAccessGate"

test("renderiza apenas a navegação restrita, sem conteúdo da plataforma, para conta restrita", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate decision={{ state: "restricted", reason: "past_due" }}>
      <aside data-testid="sidebar">sidebar</aside>
      <header data-testid="header">header</header>
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("Seu acesso está pausado")
  expect(markup).toContain('data-testid="restricted-access-sidebar"')
  expect(markup).toContain("Trocar de time")
  expect(markup).toContain("Sair")
  expect(markup).not.toContain("data-testid=\"sidebar\"")
  expect(markup).not.toContain("data-testid=\"header\"")
  expect(markup).not.toContain("dados financeiros e CRM")
  expect(markup).toContain("w-full max-w-md")
  expect(markup).toContain("p-4")
  // Sem ser o master (quem paga), não há botão de reativar: só a orientação e o suporte.
  expect(markup).not.toContain("Reativar assinatura")
  expect(markup).toContain("Seu acesso volta automaticamente")
})

test("na carência mostra o aviso de vencimento sobre o conteúdo, sem bloquear", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate
      decision={{
        state: "allowed",
        temporaryAccessGranted: true,
        temporaryAccessUntil: "2026-11-08T03:00:00.000Z",
        billingGraceUntil: "2026-11-08T03:00:00.000Z",
      }}
      decisionResolved
    >
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("A assinatura desta conta está pendente")
  expect(markup).toContain("dados financeiros e CRM")
})

test("concessão operacional (sem billingGraceUntil) não mostra aviso de vencimento", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate
      decision={{ state: "allowed", temporaryAccessGranted: true, temporaryAccessUntil: null }}
      decisionResolved
    >
      <section>conteúdo</section>
    </AccountAccessGate>
  )

  expect(markup).not.toContain("venceu")
})

test("falha fechado quando a decisão autenticada não foi resolvida", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate decision={null} decisionResolved>
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("Seu acesso está pausado")
  expect(markup).not.toContain("dados financeiros e CRM")
})

test("libera o conteúdo para conta com acesso permitido", () => {
  const markup = renderToStaticMarkup(
    <AccountAccessGate decision={{ state: "allowed" }} decisionResolved>
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("dados financeiros e CRM")
  expect(markup).not.toContain("Seu acesso está pausado")
})

test("sessão na URL de outra conta sem decisão resolvida nunca exibe pausa alheia", () => {
  // Cenário do incidente: sessão de A na URL de B. O bootstrap server-side
  // recusa o mismatch (retorna null), então o gate recebe decision
  // indefinida + não resolvida e deve renderizar o conteúdo — jamais a
  // tela de pausa da conta da URL.
  const markup = renderToStaticMarkup(
    <AccountAccessGate decision={undefined} decisionResolved={false}>
      <section data-testid="platform-content">dados financeiros e CRM</section>
    </AccountAccessGate>
  )

  expect(markup).toContain("dados financeiros e CRM")
  expect(markup).not.toContain("Seu acesso está pausado")
})
