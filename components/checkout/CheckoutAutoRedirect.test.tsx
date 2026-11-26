import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CHECKOUT_REDIRECT_SECONDS, CheckoutAutoRedirect, tickCheckoutCountdown } from "./CheckoutAutoRedirect"

describe("tickCheckoutCountdown", () => {
  test("desconta um segundo por vez e para em zero", () => {
    expect(tickCheckoutCountdown(5)).toBe(4)
    expect(tickCheckoutCountdown(1)).toBe(0)
    expect(tickCheckoutCountdown(0)).toBe(0)
  })
})

describe("CheckoutAutoRedirect", () => {
  test("começa com 5 segundos e oferece só ir agora, sem cancelar", () => {
    const markup = renderToStaticMarkup(createElement(CheckoutAutoRedirect, { href: "/conta-1/dashboard" }))

    expect(CHECKOUT_REDIRECT_SECONDS).toBe(5)
    expect(markup).toContain("Você será levado ao Corretor Studio em 5 s.")
    expect(markup).toContain('href="/conta-1/dashboard"')
    expect(markup).toContain("Ir agora")
    expect(markup).not.toContain("Cancelar")
  })
})
