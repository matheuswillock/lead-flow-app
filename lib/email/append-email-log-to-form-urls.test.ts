import { describe, expect, it } from "bun:test"
import {
  appendEmailLogIdToFormUrls,
  EMAIL_LOG_FORM_QUERY_PARAM,
} from "./append-email-log-to-form-urls"

const LOG_ID = "11111111-1111-4111-8111-111111111111"
const FORM_ID = "22222222-2222-4222-8222-222222222222"

describe("appendEmailLogIdToFormUrls", () => {
  it("anexa cs_el em href absoluto de formulário", () => {
    const html = `<a href="https://app.example.com/forms/${FORM_ID}">Abrir</a>`
    const out = appendEmailLogIdToFormUrls(html, LOG_ID)
    expect(out).toContain(`${EMAIL_LOG_FORM_QUERY_PARAM}=${LOG_ID}`)
    expect(out).toContain(`/forms/${FORM_ID}`)
  })

  it("anexa cs_el em href relativo e preserva query existente", () => {
    const html = `<a href="/forms/${FORM_ID}?utm_source=email">Abrir</a>`
    const out = appendEmailLogIdToFormUrls(html, LOG_ID)
    expect(out).toContain("utm_source=email")
    expect(out).toContain(`${EMAIL_LOG_FORM_QUERY_PARAM}=${LOG_ID}`)
  })

  it("não altera HTML sem links de formulário", () => {
    const html = `<a href="https://example.com">x</a>`
    expect(appendEmailLogIdToFormUrls(html, LOG_ID)).toBe(html)
  })

  it("ignora emailLogId vazio", () => {
    const html = `<a href="/forms/${FORM_ID}">Abrir</a>`
    expect(appendEmailLogIdToFormUrls(html, "  ")).toBe(html)
  })
})
