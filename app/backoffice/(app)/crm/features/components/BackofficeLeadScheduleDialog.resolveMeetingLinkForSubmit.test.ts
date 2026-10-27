import { describe, expect, test } from "bun:test"
import { resolveMeetingLinkForSubmit } from "./BackofficeLeadScheduleDialog"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1c — achado da revisão final
 * (R13-8): antes desta correção, o payload de submit enviava
 * `linkValidation.normalized ?? (link.trim() || null)` incondicionalmente.
 * Como `linkValidation` só é calculada quando `isOnlineMeeting` é `true`
 * (para não travar o campo escondido em telefone/WhatsApp), fora disso
 * `normalized` é sempre `undefined` — e o fallback reenviava o `link` cru
 * herdado do lead (possivelmente `http:` legado), que o servidor recusava.
 *
 * Controle negativo: trocar o `if (!params.isOnlineMeeting) return null` por
 * `params.normalizedMeetingLink ?? (params.link.trim() || null)` incondicional
 * faz o segundo teste falhar.
 */
describe("resolveMeetingLinkForSubmit — T-13.3c (R13-8)", () => {
  test("reunião online: usa o valor normalizado quando disponível", () => {
    const result = resolveMeetingLinkForSubmit({
      isOnlineMeeting: true,
      link: "https://meet.google.com/abc-defg-hij",
      normalizedMeetingLink: "https://meet.google.com/abc-defg-hij",
    })
    expect(result).toBe("https://meet.google.com/abc-defg-hij")
  })

  test("reunião por telefone/WhatsApp: nunca reenvia o link herdado, mesmo que seja http: legado", () => {
    const result = resolveMeetingLinkForSubmit({
      isOnlineMeeting: false,
      link: "http://meet.google.com/abc-defg-hij",
      normalizedMeetingLink: undefined,
    })
    expect(result).toBeNull()
  })

  test("reunião online sem link informado: null, não string vazia", () => {
    const result = resolveMeetingLinkForSubmit({
      isOnlineMeeting: true,
      link: "",
      normalizedMeetingLink: undefined,
    })
    expect(result).toBeNull()
  })
})
