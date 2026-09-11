import { describe, expect, it } from "bun:test"
import { createDefaultThankYouPage } from "./thank-you-pages"
import {
  canCreateLeadFromExtracted,
  canUpdateLeadFromExtracted,
  extractLeadDataFromSnapshot,
  hasCrmGateAC,
  overlayRadarIdentityOnExtracted,
  isBrazilianContactPhone,
  isBrazilianLandlinePhone,
  isBrazilianMobilePhone,
  isValidPersonLeadName,
  resolveLeadDiscardReason,
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

  it("cria lead com nome de uma palavra e celular sem e-mail", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria" },
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(canCreateLeadFromExtracted(extracted)).toBe(true)
  })

  it("cria lead com nome de uma palavra e telefone fixo", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria" },
      { questionId: phoneId, value: "(11) 3897-1122" },
      { questionId: emailId, value: "maria@example.com" },
    ])
    expect(canCreateLeadFromExtracted(extracted)).toBe(true)
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
      false,
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

  it("overlay do perfil Radar preenche nome e fecha A+C com telefone do form", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(hasCrmGateAC(extracted)).toBe(false)
    const unified = overlayRadarIdentityOnExtracted(extracted, {
      displayName: "Maria Silva",
      primaryEmail: null,
      displayPhone: null,
      normalizedPhone: null,
    })
    expect(unified.name).toBe("Maria Silva")
    expect(hasCrmGateAC(unified)).toBe(true)
  })

  it("overlay ignora Visitante Anônimo e converte telefone Radar 55… para dígitos do lead", () => {
    const extracted = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
    ])
    const unified = overlayRadarIdentityOnExtracted(extracted, {
      displayName: "Visitante Anônimo",
      normalizedPhone: "5511988887777",
      displayPhone: "+55 11 98888-7777",
    })
    expect(unified.name).toBe("Maria Silva")
    expect(unified.normalizedPhone).toBe("11988887777")
    expect(hasCrmGateAC(unified)).toBe(true)
  })

  // SPEC 40-E1 adenda (bug 2026-09-01, caso GERSON/KKJ): telefone digitado
  // com o código do país (55) precisa normalizar ANTES da régua, protegendo
  // qualquer canal que entregue o valor de 12-13 dígitos inteiro ao servidor
  // (import, colagem, API) — não só o form corrigido pela máscara do
  // frontend.
  it("T-F1.6: normaliza telefone com DDI 55 de 12-13 dígitos e cria o lead (caso GERSON)", () => {
    const gerson = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Gerson de Oliveira" },
      { questionId: phoneId, value: "55 11 2422-2006" },
    ])
    expect(gerson.normalizedPhone).toBe("1124222006")
    expect(canCreateLeadFromExtracted(gerson)).toBe(true)
    expect(resolveLeadDiscardReason(gerson, { hasMatchingLead: false })).toBeNull()

    const celularComDdi = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Nathany Souza" },
      { questionId: phoneId, value: "+55 (11) 98230-8088" },
    ])
    expect(celularComDdi.normalizedPhone).toBe("11982308088")
    expect(canCreateLeadFromExtracted(celularComDdi)).toBe(true)
  })

  it("T-F1.6: nunca remove o 55 de um DDD 55 (RS) legítimo", () => {
    const celularGaucho = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Rosane Goncalves" },
      { questionId: phoneId, value: "(55) 99632-6534" },
    ])
    expect(celularGaucho.normalizedPhone).toBe("55996326534")
    expect(canCreateLeadFromExtracted(celularGaucho)).toBe(true)

    const fixoGaucho = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Rosane Goncalves" },
      { questionId: phoneId, value: "55 3261-1122" },
    ])
    expect(fixoGaucho.normalizedPhone).toBe("5532611122")
    expect(canCreateLeadFromExtracted(fixoGaucho)).toBe(true)
  })

  it("T-F1.6 (controle): valor sem forma válida após o strip continua descartado — backend não inventa dígito", () => {
    const matheusTeste = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Matheus Teste" },
      { questionId: phoneId, value: "(55) 19118-0656" },
    ])
    expect(matheusTeste.normalizedPhone).toBe("55191180656")
    expect(canCreateLeadFromExtracted(matheusTeste)).toBe(false)
    expect(resolveLeadDiscardReason(matheusTeste, { hasMatchingLead: false })).toBe(
      "telefone_invalido",
    )
  })

  it("T-F1.7: telefone já normalizado não muda — round-trip idempotente", () => {
    const already = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: phoneId, value: "(11) 98888-7777" },
    ])
    expect(already.normalizedPhone).toBe("11988887777")

    const reprocessed = extractLeadDataFromSnapshot(snapshot(), [
      { questionId: nameId, value: "Maria Silva" },
      { questionId: phoneId, value: already.normalizedPhone },
    ])
    expect(reprocessed.normalizedPhone).toBe(already.normalizedPhone)
    expect(canCreateLeadFromExtracted(reprocessed)).toBe(true)
  })
})
