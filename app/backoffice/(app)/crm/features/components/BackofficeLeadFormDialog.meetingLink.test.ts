import { describe, expect, test } from "bun:test"
import { leadFormSchema } from "./BackofficeLeadFormDialog"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1d — achado da revisão (R13d-4):
 * este formulário reenvia `meetingLink` no submit e o exibe como `<a href>`,
 * mas validava com `z.string().url()` (aceita `javascript:` e `http:`) e só
 * quando o status era "scheduled".
 *
 * Controle negativo: voltar o superRefine para
 * `if (data.meetingLink && !z.string().url().safeParse(data.meetingLink).success)`
 * faz os testes de `javascript:` e `http:` novo falharem.
 */
const VALID_VALUES = {
  name: "Lead Teste",
  email: "",
  phone: "",
  cpfCnpj: "",
  notes: "",
  status: "new_opportunity",
  sdrBackofficeUserId: "sdr-1",
  closerBackofficeUserId: "closer-1",
  meetingDate: "",
  meetingTitle: "",
  meetingNotes: "",
  meetingLink: "",
  persistedMeetingLink: "",
  meetingType: "online",
  meetingExtraGuests: [],
  qualificationLeadOrganization: "",
  qualificationAvgUsers: "",
  qualificationProfileFit: "",
}

function meetingLinkIssue(values: Record<string, unknown>) {
  const result = leadFormSchema.safeParse({ ...VALID_VALUES, ...values })
  if (result.success) return undefined
  return result.error.issues.find((issue) => issue.path[0] === "meetingLink")
}

describe("BackofficeLeadFormDialog leadFormSchema — meetingLink só https (R13d-4)", () => {
  test("aceita link https", () => {
    expect(meetingLinkIssue({ meetingLink: "https://meet.google.com/abc-defg-hij" })).toBeUndefined()
  })

  test("recusa esquema javascript:", () => {
    expect(meetingLinkIssue({ meetingLink: "javascript:document.location=document.cookie" })).toBeDefined()
  })

  test("recusa javascript: também com status agendado", () => {
    expect(
      meetingLinkIssue({
        status: "scheduled",
        meetingDate: "2026-09-30T14:00:00.000Z",
        meetingLink: "javascript:void(0)",
      })
    ).toBeDefined()
  })

  test("recusa link http novo", () => {
    expect(meetingLinkIssue({ meetingLink: "http://meet.google.com/abc-defg-hij" })).toBeDefined()
  })

  test("aceita http legado só quando é o link já gravado no lead", () => {
    const stored = "http://meet.google.com/abc-defg-hij"
    expect(meetingLinkIssue({ meetingLink: stored, persistedMeetingLink: stored })).toBeUndefined()
    expect(
      meetingLinkIssue({ meetingLink: "http://meet.google.com/outro", persistedMeetingLink: stored })
    ).toBeDefined()
  })

  test("link vazio é aceito", () => {
    expect(meetingLinkIssue({ meetingLink: "" })).toBeUndefined()
  })
})
