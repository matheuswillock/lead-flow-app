import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { BillingGraceBanner, billingGraceCopy } from "./BillingGraceBanner"

const GRACE_UNTIL = "2026-11-08T03:00:00.000Z"

test("master: pede a regularização com a data limite e mostra o atalho para pagar", () => {
  const markup = renderToStaticMarkup(createElement(BillingGraceBanner, {
    graceUntil: GRACE_UNTIL,
    isBillingOwner: true,
    regularizeHref: "/supabase-1/billing-grace-payment",
  }))

  expect(markup).toContain("Sua assinatura venceu")
  expect(markup).toContain("Regularize o pagamento até 08/11")
  expect(markup).toContain("Regularizar pagamento")
})

test("usuário: só é avisado do vencimento, sem botão de pagamento", () => {
  const markup = renderToStaticMarkup(createElement(BillingGraceBanner, {
    graceUntil: GRACE_UNTIL,
    isBillingOwner: false,
    regularizeHref: "/supabase-1/billing-grace-payment",
  }))

  expect(markup).toContain("A assinatura desta conta está pendente")
  expect(markup).toContain("o acesso será pausado")
  expect(markup).not.toContain("Regularizar pagamento")
})

test("a data usa o fuso de São Paulo", () => {
  // 03:00Z do dia 08 ainda é 00:00 do dia 08 em São Paulo.
  expect(billingGraceCopy({ graceUntil: GRACE_UNTIL, isBillingOwner: true }).description).toContain("08/11")
})
