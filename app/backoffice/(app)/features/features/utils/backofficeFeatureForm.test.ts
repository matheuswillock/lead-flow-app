import { describe, expect, it } from "bun:test"
import { EMPTY_FEATURE_FORM } from "../context/BackofficeFeatureTypes"
import {
  applyBetaEnabledChange,
  canChargeDuringBeta,
  formToPayload,
  getChargeDuringBetaClientHint,
  isChargeDuringBetaSaveBlocked,
  isChargeDuringBetaVisible,
} from "./backofficeFeatureForm"

describe("backofficeFeatureForm chargeDuringBeta", () => {
  it("T01: toggle de cobrança beta não é visível sem beta", () => {
    expect(isChargeDuringBetaVisible(false)).toBe(false)
  })

  it("T02: com beta ligado o toggle é visível e default de cobrança é desligado", () => {
    expect(isChargeDuringBetaVisible(true)).toBe(true)
    const next = applyBetaEnabledChange(EMPTY_FEATURE_FORM, true)
    expect(next.betaEnabled).toBe(true)
    expect(next.chargeDuringBeta).toBe(false)
  })

  it("T03: cobrar beta sem produto válido bloqueia salvar e mostra hint", () => {
    const form = {
      ...EMPTY_FEATURE_FORM,
      betaEnabled: true,
      chargeDuringBeta: true,
      accessMode: "ADDON" as const,
      productSlug: "",
    }
    expect(canChargeDuringBeta(form)).toBe(false)
    expect(getChargeDuringBetaClientHint(form)).toBe(
      "Para ligar esta opção, selecione um produto válido em Precificação."
    )
    expect(isChargeDuringBetaSaveBlocked(form)).toBe(true)
  })

  it("T03b: cobrar beta com PUBLIC também bloqueia", () => {
    const form = {
      ...EMPTY_FEATURE_FORM,
      betaEnabled: true,
      chargeDuringBeta: true,
      accessMode: "PUBLIC" as const,
      productSlug: "email",
    }
    expect(isChargeDuringBetaSaveBlocked(form)).toBe(true)
  })

  it("T03c: beta + ADDON + produto válido libera salvar", () => {
    const form = {
      ...EMPTY_FEATURE_FORM,
      betaEnabled: true,
      chargeDuringBeta: true,
      accessMode: "ADDON" as const,
      productSlug: "email",
    }
    expect(isChargeDuringBetaSaveBlocked(form)).toBe(false)
    expect(getChargeDuringBetaClientHint(form)).toBeNull()
  })

  it("desligar beta zera chargeDuringBeta", () => {
    const prev = {
      ...EMPTY_FEATURE_FORM,
      betaEnabled: true,
      chargeDuringBeta: true,
    }
    const next = applyBetaEnabledChange(prev, false)
    expect(next.betaEnabled).toBe(false)
    expect(next.chargeDuringBeta).toBe(false)
  })

  it("formToPayload inclui chargeDuringBeta", () => {
    const payload = formToPayload({
      ...EMPTY_FEATURE_FORM,
      name: "E-mail",
      betaEnabled: true,
      chargeDuringBeta: true,
      accessMode: "ADDON",
      productSlug: "email",
    })
    expect(payload.chargeDuringBeta).toBe(true)
    expect(payload.betaEnabled).toBe(true)
    expect(payload.productSlug).toBe("email")
  })
})
