import { expect, mock, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

let currentPathname: string | null = null
const actualNavigation = await import("next/navigation")
mock.module("next/navigation", () => ({
  ...actualNavigation,
  usePathname: () => currentPathname,
  useParams: () => ({ supabaseId: "conta-1" }),
  useRouter: () => ({ replace: () => undefined }),
}))

// Por padrão, nenhum slug concedido (mesmo fallback "falha fechado" do componente quando
// o provedor real não está montado); testes de somente leitura sobrescrevem por caso.
let currentHasAccess: (slug: string) => boolean = () => false
mock.module("@/app/context/FeatureAccessContext", () => ({
  useOptionalFeatureAccess: () => ({ hasAccess: currentHasAccess }),
}))

const { AccountAccessGate } = await import("./AccountAccessGate")

const PAYMENT_PATH = "/conta-1/billing-grace-payment"
const PAYMENT_HREF = 'href="/conta-1/billing-grace-payment"'

function renderGate({
  pathname,
  reason,
  isBillingOwner,
}: {
  pathname: string
  reason: "banned" | "past_due" | "suspended" | "canceled" | "subscription_unavailable"
  isBillingOwner: boolean
}) {
  currentPathname = pathname
  return renderToStaticMarkup(
    <AccountAccessGate decision={{ state: "restricted", reason, isBillingOwner }}>
      <section data-testid="platform-content">pagamento e CRM</section>
    </AccountAccessGate>
  )
}

test("master pausado recebe o botão de pagamento, sem o WhatsApp", () => {
  const markup = renderGate({ pathname: "/conta-1/dashboard", reason: "past_due", isBillingOwner: true })

  expect(markup).toContain("Seu acesso está pausado")
  expect(markup).toContain("Reativar assinatura")
  expect(markup).toContain(PAYMENT_HREF)
  expect(markup).not.toContain("wa.me")
  expect(markup).not.toContain("pagamento e CRM")
})

test("quem não é master vê só o aviso, sem botão de pagamento nem WhatsApp", () => {
  const markup = renderGate({ pathname: "/conta-1/dashboard", reason: "past_due", isBillingOwner: false })

  expect(markup).toContain("Avise o administrador desta conta")
  expect(markup).not.toContain("Reativar assinatura")
  expect(markup).not.toContain("billing-grace-payment")
  expect(markup).not.toContain("wa.me")
})

test("banido, mesmo master, só fala com o time de assinaturas", () => {
  const markup = renderGate({ pathname: "/conta-1/dashboard", reason: "banned", isBillingOwner: true })

  expect(markup).toContain("Falar com o time de assinaturas")
  expect(markup).toContain("wa.me")
  expect(markup).not.toContain("Reativar assinatura")
})

test("libera a página de pagamento só para o master que pode pagar", () => {
  const owner = renderGate({ pathname: PAYMENT_PATH, reason: "suspended", isBillingOwner: true })

  expect(owner).toContain("pagamento e CRM")
  expect(owner).not.toContain("Seu acesso está pausado")
})

test("mantém a tela pausada na página de pagamento para quem não pode usá-la", () => {
  const member = renderGate({ pathname: PAYMENT_PATH, reason: "past_due", isBillingOwner: false })
  const bannedOwner = renderGate({ pathname: PAYMENT_PATH, reason: "banned", isBillingOwner: true })
  const unavailableOwner = renderGate({
    pathname: PAYMENT_PATH,
    reason: "subscription_unavailable",
    isBillingOwner: true,
  })

  for (const markup of [member, bannedOwner, unavailableOwner]) {
    expect(markup).toContain("Seu acesso está pausado")
    expect(markup).not.toContain("pagamento e CRM")
  }
})

test("a liberação vale só para a rota de pagamento: o resto segue pausado para o master", () => {
  for (const pathname of ["/conta-1/subscription", "/conta-1/billing-grace-payment/extra"]) {
    const markup = renderGate({ pathname, reason: "past_due", isBillingOwner: true })

    expect(markup).toContain("Seu acesso está pausado")
    expect(markup).not.toContain("pagamento e CRM")
  }
})

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
  // Sem ser o master (quem paga), não há botão de reativar nem WhatsApp: só a orientação.
  expect(markup).not.toContain("Reativar assinatura")
  expect(markup).not.toContain("wa.me")
  expect(markup).toContain("Avise o administrador desta conta")
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

function renderReadOnlyGate({ pathname, isBillingOwner }: { pathname: string; isBillingOwner: boolean }) {
  currentPathname = pathname
  return renderToStaticMarkup(
    <AccountAccessGate decision={{ state: "read_only", reason: "past_due", isBillingOwner }}>
      <section data-testid="platform-content">conteúdo da rota</section>
    </AccountAccessGate>
  )
}

test("somente leitura mantém visível o que a conta já tinha contratado (CRM e Carteira)", () => {
  currentHasAccess = (slug) => slug === "crm" || slug === "crm-wallet"
  try {
    for (const pathname of ["/conta-1/crm", "/conta-1/carteira", "/conta-1/carteira/lead-9"]) {
      const markup = renderReadOnlyGate({ pathname, isBillingOwner: false })

      expect(markup).toContain("conteúdo da rota")
      expect(markup).not.toContain("read-only-redirect")
    }
  } finally {
    currentHasAccess = () => false
  }
})

test("somente leitura esconde o que a conta não tinha contratado e leva ao CRM", () => {
  currentHasAccess = (slug) => slug === "crm" || slug === "crm-wallet"
  try {
    for (const pathname of ["/conta-1/dashboard", "/conta-1/email/campanhas", "/conta-1/whatsapp"]) {
      const markup = renderReadOnlyGate({ pathname, isBillingOwner: true })

      expect(markup).not.toContain("conteúdo da rota")
      expect(markup).toContain("read-only-redirect")
      expect(markup).toContain('data-href="/conta-1/crm"')
    }
  } finally {
    currentHasAccess = () => false
  }
})

test("somente leitura libera rotas sem slug de feature (ex.: assinatura), mesmo sem nada contratado", () => {
  const markup = renderReadOnlyGate({ pathname: "/conta-1/subscription", isBillingOwner: true })

  expect(markup).toContain("conteúdo da rota")
})

test("somente leitura libera a página de pagamento só para o master", () => {
  const owner = renderReadOnlyGate({ pathname: "/conta-1/billing-grace-payment", isBillingOwner: true })
  const member = renderReadOnlyGate({ pathname: "/conta-1/billing-grace-payment", isBillingOwner: false })

  expect(owner).toContain("conteúdo da rota")
  expect(member).not.toContain("conteúdo da rota")
  expect(member).toContain("read-only-redirect")
})
