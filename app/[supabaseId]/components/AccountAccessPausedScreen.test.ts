import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  AccountAccessPausedScreen,
  SUBSCRIPTION_SUPPORT_WHATSAPP_URL,
} from "./AccountAccessPausedScreen"

const REACTIVATE_HREF = "/supabase-1/billing-grace-payment"

test("usa o WhatsApp de assinaturas com a mensagem humanizada codificada", () => {
  const url = new URL(SUBSCRIPTION_SUPPORT_WHATSAPP_URL)

  expect(url.hostname).toBe("wa.me")
  expect(url.pathname).toBe("/5511939534668")
  expect(url.searchParams.get("text")).toBe(
    "Olá! Minha conta do Corretor Studio está com o acesso pausado e preciso de orientação sobre os próximos passos."
  )
  expect(url.searchParams.get("text")).not.toContain("Bruno")
})

test("o master reativa a assinatura pagando a renovação, com uma única ação", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: true,
    reason: "past_due",
    reactivateHref: REACTIVATE_HREF,
  }))

  expect(markup).toContain("Reativar assinatura")
  expect(markup).toContain(`href="${REACTIVATE_HREF}"`)
  expect(markup).not.toContain("wa.me")
})

test("o membro não paga: só é avisado de que o acesso volta sozinho, sem ações", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: false,
    reason: "past_due",
    reactivateHref: REACTIVATE_HREF,
  }))

  expect(markup).not.toContain("Reativar assinatura")
  expect(markup).not.toContain("wa.me")
  expect(markup).toContain("Seu acesso volta automaticamente assim que a assinatura desta conta for regularizada.")
})

test("conta banida não se reativa com pagamento: só o time de assinaturas", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: true,
    reason: "banned",
    reactivateHref: REACTIVATE_HREF,
  }))

  expect(markup).not.toContain("Reativar assinatura")
  expect(markup).toContain("Falar com o time de assinaturas")
})
