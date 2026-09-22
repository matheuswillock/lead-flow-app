import { describe, expect, test } from "bun:test"
import { validateMeetingLinkValue } from "./meetingLink"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1c/DA8 — `href` de e-mail só aceita
 * `https:`. Antes desta correção, `validateMeetingLinkValue` também aceitava
 * `http:` como link de reunião válido, contrariando a DA8: um link `http:`
 * gravado como reunião acabava virando `<a href="http://...">` em algum
 * template (ver T-13.3c). A validação de entrada precisa recusar `http:` na
 * origem.
 */
describe("validateMeetingLinkValue — T-13.2c", () => {
  test("aceita https:", () => {
    const result = validateMeetingLinkValue("https://meet.google.com/abc-defg-hij")
    expect(result.isValid).toBe(true)
  })

  test("recusa http: (controle negativo: reverter para aceitar http: faz este teste falhar)", () => {
    const result = validateMeetingLinkValue("http://meet.google.com/abc-defg-hij")
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.error).toContain("https")
    }
  })

  test("recusa javascript:", () => {
    const result = validateMeetingLinkValue("javascript:evilJs(1)")
    expect(result.isValid).toBe(false)
  })

  test("campo obrigatório vazio recusa e cita https", () => {
    const result = validateMeetingLinkValue("", { required: true })
    expect(result.isValid).toBe(false)
    if (!result.isValid) {
      expect(result.error).toContain("https")
    }
  })

  test("campo opcional vazio continua válido (sem valor)", () => {
    const result = validateMeetingLinkValue(undefined, { required: false })
    expect(result.isValid).toBe(true)
  })
})

/**
 * Achado da revisão xhigh do PR de A-E1c (R13-1/R13-2): reunião já gravada com
 * link `http:` não pode quebrar toda edição futura (mudar data, closer,
 * título…) só porque a validação de `href` passou a exigir `https:`. Os
 * chamadores (`LeadScheduleService`, `BackofficeLeadScheduleService`, a rota
 * `/api/v1/leads/[id]/schedule`, `ScheduleMeetingDialog`,
 * `BackofficeLeadScheduleDialog`) passam `allowLegacyHttp: true` só quando o
 * valor recebido é exatamente o link já persistido (não editado nesta
 * chamada). Controle negativo: tirar `allowLegacyHttp` de `meetingLink.ts` faz
 * este teste falhar.
 */
describe("validateMeetingLinkValue — allowLegacyHttp (achado R13-1/R13-2)", () => {
  test("http: com allowLegacyHttp: true é aceito (link legado não tocado)", () => {
    const result = validateMeetingLinkValue("http://meet.google.com/abc-defg-hij", {
      allowLegacyHttp: true,
    })
    expect(result.isValid).toBe(true)
  })

  test("http: com allowLegacyHttp: false continua recusado (link novo precisa https)", () => {
    const result = validateMeetingLinkValue("http://meet.google.com/abc-defg-hij", {
      allowLegacyHttp: false,
    })
    expect(result.isValid).toBe(false)
  })

  test("allowLegacyHttp não abre exceção para javascript: nem outros esquemas", () => {
    const result = validateMeetingLinkValue("javascript:evilJs(1)", { allowLegacyHttp: true })
    expect(result.isValid).toBe(false)
  })

  test("allowLegacyHttp não dispensa os outros controles (caractere de controle continua recusado)", () => {
    const result = validateMeetingLinkValue("http://meet.google.com/abc\u0000", {
      allowLegacyHttp: true,
    })
    expect(result.isValid).toBe(false)
  })
})
