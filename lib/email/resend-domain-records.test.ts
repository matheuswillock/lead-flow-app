import { describe, expect, it } from "bun:test"
import { hasVerifiedSendingDns, isTrackingDnsRecord } from "./resend-domain-records"

describe("isTrackingDnsRecord", () => {
  it("classifica os registros de métrica", () => {
    expect(isTrackingDnsRecord("Tracking")).toBe(true)
    expect(isTrackingDnsRecord("TrackingCAA")).toBe(true)
    expect(isTrackingDnsRecord(" Tracking ")).toBe(true)
  })

  it("não classifica os registros de envio nem valores ausentes", () => {
    expect(isTrackingDnsRecord("DKIM")).toBe(false)
    expect(isTrackingDnsRecord("SPF")).toBe(false)
    expect(isTrackingDnsRecord("Receiving")).toBe(false)
    expect(isTrackingDnsRecord(null)).toBe(false)
    expect(isTrackingDnsRecord(undefined)).toBe(false)
    expect(isTrackingDnsRecord("")).toBe(false)
  })
})

describe("hasVerifiedSendingDns", () => {
  it("caso Liber: DKIM e SPF verificados, tracking falhou → envio ok", () => {
    expect(
      hasVerifiedSendingDns([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "SPF", status: "verified" },
        { record: "Tracking", status: "failed" },
      ])
    ).toBe(true)
  })

  it("DKIM quebrado bloqueia mesmo com tracking verificado", () => {
    // É o caso que "aceitar partially_failed em bloco" deixaria passar, e o
    // e-mail sairia sem assinatura.
    expect(
      hasVerifiedSendingDns([
        { record: "DKIM", status: "failed" },
        { record: "SPF", status: "verified" },
        { record: "Tracking", status: "verified" },
      ])
    ).toBe(false)
  })

  it("SPF pendente bloqueia", () => {
    expect(
      hasVerifiedSendingDns([
        { record: "DKIM", status: "verified" },
        { record: "SPF", status: "pending" },
      ])
    ).toBe(false)
  })

  it("lista vazia ou ausente não conta como verificado", () => {
    // Ausência de registro não é prova de verificação: o Resend omite `records`
    // enquanto não processou o domínio.
    expect(hasVerifiedSendingDns([])).toBe(false)
    expect(hasVerifiedSendingDns(null)).toBe(false)
    expect(hasVerifiedSendingDns(undefined)).toBe(false)
  })

  it("só tracking na lista não conta — não há registro de envio para avaliar", () => {
    expect(hasVerifiedSendingDns([{ record: "Tracking", status: "verified" }])).toBe(false)
  })

  it("registro sem tipo é tratado como envio, não como tracking", () => {
    // Conservador: um registro que não sabemos classificar não pode ser
    // descartado da conta, senão um DKIM sem rótulo viraria "ok" por omissão.
    expect(hasVerifiedSendingDns([{ status: "failed" }])).toBe(false)
    expect(hasVerifiedSendingDns([{ status: "verified" }])).toBe(true)
  })
})
