import { expect, mock, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { AccountAccessDecision } from "@/app/api/shared/accountAccessDecision/types"

let currentDecision: AccountAccessDecision | null = null

mock.module("next/navigation", () => ({
  useParams: () => ({ supabaseId: "conta-1" }),
}))
mock.module("@/app/context/TeamContext", () => ({
  useOptionalTeamContext: () => ({ accountAccessDecision: currentDecision }),
}))

const { SubscriptionGuard } = await import("./subscription-guard")

function render(decision: AccountAccessDecision | null, hasActiveSubscription = false) {
  currentDecision = decision
  return renderToStaticMarkup(
    <SubscriptionGuard hasActiveSubscription={hasActiveSubscription} isLoading={false} userRole="manager">
      <section>conteúdo do CRM</section>
    </SubscriptionGuard>
  )
}

test("conta com acesso pleno vê o conteúdo", () => {
  expect(render({ state: "allowed" })).not.toContain("Sem Acesso à Plataforma")
})

test("conta em somente leitura vê o conteúdo, sem o aviso de assinatura inativa", () => {
  const markup = render({ state: "read_only", reason: "past_due" })

  expect(markup).toContain("conteúdo do CRM")
  expect(markup).not.toContain("blur-sm")
  expect(markup).not.toContain("Sem Acesso à Plataforma")
  expect(markup).not.toContain("Assinatura Inativa")
})

test("conta restrita sem assinatura segue bloqueada pelo aviso", () => {
  const markup = render({ state: "restricted", reason: "past_due" })

  expect(markup).toContain("blur-sm")
  expect(markup).toContain("Sem Acesso à Plataforma")
})
