import { describe, expect, it } from "bun:test"
import { createDefaultThankYouPage } from "./thank-you-pages"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
  isBrazilianContactPhone,
  isBrazilianLandlinePhone,
  isBrazilianMobilePhone,
  isValidPersonLeadName,
} from "./lead-identity"
import type { PublicFormSnapshot } from "./types"

const nameId = "11111111-1111-4111-8111-111111111111"
const phoneId = "22222222-2222-4222-8222-222222222222"
const emailId = "33333333-3333-4333-8333-333333333333"
const defaultThanks = createDefaultThankYouPage()

function snapshot(): PublicFormSnapshot {
  return {
    formId: "form-1",
    publicId: "pub-1",
    version: 1,
    publishedAt: new Date().toISOString(),
    name: "Qualificação PME",
    eligibleCloserIds: [],
    ctaLabel: "Começar",
    successTitle: "Ok",
    successActions: [],
    thankYouPages: [defaultThanks],
    defaultThankYouPageId: defaultThanks.id,
    useDefaultTheme: true,
    schedulingEnabled: false,
    meetingDurationMinutes: 30,
    rules: [],
    scoreBands: [],
    theme: {
      backgroundColor: "#fff",
      textColor: "#111",
      lineColor: "#eee",
      accentColor: "#FF6900",
      buttonTextColor: "#FFFFFF",
      inputBackgroundColor: "#FFFFFF",
    },
    questions: [
      {
        id: nameId,
        type: "text",
        title: "Nome",
        required: true,
        scoreWeight: 50,
        position: 0,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "name",
      },
      {
        id: phoneId,
        type: "phone",
        title: "Telefone",
        required: true,
        scoreWeight: 25,
        position: 1,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "phone",
      },
      {
        id: emailId,
        type: "email",
        title: "E-mail",
        required: false,
        scoreWeight: 25,
        position: 2,
        options: [],
        mappingTarget: "native_field",
        mappingKey: "email",
      },
    ],
  }
}

describe("lead identity from public forms", () => {
  it("cria lead com nome completo e celular 11 dígitos com 9", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(isBrazilianMobilePhone("11988857773")).toBe(true)
    expect(isBrazilianContactPhone("11988857773")).toBe(true)
    expect(canCreateLeadFromExtracted(extracted)).toBe(true)
    expect(hasCrmGateAC(extracted)).toBe(true)
    expect(canUpdateLeadFromExtracted(extracted)).toBe(true)
  })

  it("cria lead com nome completo e telefone fixo 10 dígitos", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: phoneId, value: "(11) 3897-1122" },
    ])
    expect(isBrazilianMobilePhone("1138971122")).toBe(false)
    expect(isBrazilianLandlinePhone("1138971122")).toBe(true)
    expect(isBrazilianContactPhone("1138971122")).toBe(true)
    expect(canCreateLeadFromExtracted(extracted)).toBe(true)

    expect(isBrazilianLandlinePhone("1198887777")).toBe(false)
    expect(isBrazilianContactPhone("1198887777")).toBe(false)
    const truncatedMobile = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: phoneId, value: "(11) 9888-7777" },
    ])
    expect(truncatedMobile.normalizedPhone).toBe("1198887777")
    expect(canCreateLeadFromExtracted(truncatedMobile)).toBe(false)
  })

  it("cria lead com nome de uma palavra, celular e e-mail", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria" },
      { questionId: phoneId, value: "(11) 98888-7777" },
      { questionId: emailId, value: "maria@example.com" },
    ])
    expect(isValidPersonLeadName("Maria")).toBe(true)
    expect(canCreateLeadFromExtracted(extracted)).toBe(true)
  })

  it("não cria lead com nome de uma palavra e celular sem e-mail", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria" },
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(canCreateLeadFromExtracted(extracted)).toBe(false)
  })

  it("não cria lead com nome de uma palavra e telefone fixo mesmo com e-mail", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria" },
      { questionId: phoneId, value: "(11) 3897-1122" },
      { questionId: emailId, value: "maria@example.com" },
    ])
    expect(canCreateLeadFromExtracted(extracted)).toBe(false)
  })

  it("não cria lead sem telefone", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: emailId, value: "maria@example.com" },
    ])
    expect(canCreateLeadFromExtracted(extracted)).toBe(false)
    expect(canUpdateLeadFromExtracted(extracted)).toBe(true)
  })

  it("não cria lead sem nome válido", () => {
    expect(isValidPersonLeadName("andressa.kaminski@primavsa.com.br")).toBe(false)
    expect(isValidPersonLeadName("andressa.kaminski", "andressa.kaminski@primavsa.com.br")).toBe(
      false
    )
    expect(isValidPersonLeadName("financeiro@3pbrasil.com.br")).toBe(false)
    expect(isValidPersonLeadName("CONSORCIO CR ALMEIDA-CONSBEM LTDA")).toBe(false)
    expect(isValidPersonLeadName("Maria Silva")).toBe(true)

    const withoutName = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(canCreateLeadFromExtracted(withoutName)).toBe(false)
    expect(canUpdateLeadFromExtracted(withoutName)).toBe(true)

    const companyName = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "CONSORCIO CR ALMEIDA-CONSBEM LTDA" },
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(canCreateLeadFromExtracted(companyName)).toBe(false)
  })
})
