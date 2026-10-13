import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  AccountAccessPausedScreen,
  SUBSCRIPTION_SUPPORT_WHATSAPP_URL,
} from "./AccountAccessPausedScreen"

test("usa o WhatsApp de assinaturas com a mensagem humanizada codificada", () => {
  const url = new URL(SUBSCRIPTION_SUPPORT_WHATSAPP_URL)

  expect(url.hostname).toBe("wa.me")
  expect(url.pathname).toBe("/5511939534668")
  expect(url.searchParams.get("text")).toBe(
    "Olá! Minha conta do Corretor Studio está com o acesso pausado e preciso de orientação sobre os próximos passos."
  )
  expect(url.searchParams.get("text")).not.toContain("Bruno")
})

test("não oferece checkout durante o bloqueio, inclusive ao master", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: true,
    reason: "past_due",
  }))

  expect(markup).not.toContain("Regularizar assinatura")
  expect(markup).toContain("Falar com o time de assinaturas")
})

test("não exibe checkout para master past_due sem migração elegível", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: true,
    reason: "past_due",
  }))

  expect(markup).not.toContain("Regularizar assinatura")
  expect(markup).toContain("Falar com o time de assinaturas")
})

test("orienta o membro a avisar o administrador da conta", () => {
  const markup = renderToStaticMarkup(createElement(AccountAccessPausedScreen, {
    isBillingOwner: false,
    reason: "past_due",
  }))

  expect(markup).toContain(
    "Avise o administrador desta conta para que ele entre em contato com o time de assinaturas."
  )
})
