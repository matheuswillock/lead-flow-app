import { expect, test } from "bun:test"
import { SUBSCRIPTION_SUPPORT_WHATSAPP_URL } from "./AccountAccessPausedScreen"

test("usa o WhatsApp de assinaturas com a mensagem humanizada codificada", () => {
  const url = new URL(SUBSCRIPTION_SUPPORT_WHATSAPP_URL)

  expect(url.hostname).toBe("wa.me")
  expect(url.pathname).toBe("/5511939534668")
  expect(url.searchParams.get("text")).toBe(
    "Olá, Bruno! Minha assinatura do Corretor Studio expirou e gostaria de renovar. Você pode me orientar sobre os próximos passos?"
  )
})
