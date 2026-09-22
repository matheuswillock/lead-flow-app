import { describe, expect, test } from "bun:test"
import {
  buildMeetingLinkMarkup,
  buildScheduleDetailsHtml,
} from "./BackofficeLeadScheduleInviteService"
import type { SendBackofficeLeadScheduleInviteInput } from "./IBackofficeLeadScheduleInviteService"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1c — achado da revisão de 21/09:
 * `buildScheduleDetailsHtml` transformava `meetingLink` em `<a href>` clicável
 * mesmo quando o link era `http:` (contraria a DA8, que só aceita `href`
 * `https:`). Reunião já gravada com link `http:` precisa continuar visível,
 * só que como texto, sem quebrar o e-mail.
 *
 * T-13.3c. Controle negativo: reverter `buildMeetingLinkMarkup` para usar
 * `escapeHtmlAttribute` sem checar o esquema faz este teste falhar.
 */

const baseInput: SendBackofficeLeadScheduleInviteInput = {
  leadName: "Ana",
  closerName: "Carlos",
  closerEmail: "carlos@example.com",
  meetingDate: new Date("2026-10-01T14:00:00Z"),
  meetingTitle: "Demonstração",
  meetingLink: "https://meet.google.com/abc-defg-hij",
  eventUid: "event-1",
}

describe("buildMeetingLinkMarkup — T-13.3c", () => {
  test("link https: vira <a href> clicável", () => {
    const markup = buildMeetingLinkMarkup("https://meet.google.com/abc-defg-hij")
    expect(markup).toContain('<a href="https://meet.google.com/abc-defg-hij"')
  })

  test("link http: vira texto, sem <a>", () => {
    const markup = buildMeetingLinkMarkup("http://meet.google.com/abc-defg-hij")
    expect(markup).not.toContain("<a ")
    expect(markup).not.toContain("href")
    expect(markup).toBe("http://meet.google.com/abc-defg-hij")
  })

  test("javascript: vira texto, sem <a>", () => {
    const markup = buildMeetingLinkMarkup("javascript:evilJs(1)")
    expect(markup).not.toContain("<a ")
  })
})

describe("buildScheduleDetailsHtml — T-13.3c", () => {
  test("meetingLink http: aparece como texto no bloco de detalhes, sem <a>", () => {
    const html = buildScheduleDetailsHtml({ ...baseInput, meetingLink: "http://meet.google.com/abc" })
    expect(html).not.toContain("<a ")
    expect(html).toContain("http://meet.google.com/abc")
  })

  test("meetingLink https: continua clicável no bloco de detalhes", () => {
    const html = buildScheduleDetailsHtml({ ...baseInput, meetingLink: "https://meet.google.com/abc" })
    expect(html).toContain('<a href="https://meet.google.com/abc"')
  })

  test("reunião por telefone/whatsapp mostra o formato, não o link", () => {
    const html = buildScheduleDetailsHtml({
      ...baseInput,
      meetingType: "call",
      meetingLink: "http://irrelevante.example.com",
    })
    expect(html).not.toContain("<a ")
    expect(html).not.toContain("irrelevante.example.com")
  })
})
