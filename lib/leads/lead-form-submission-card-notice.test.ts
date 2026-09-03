import { describe, expect, it } from "bun:test"
import {
  LEAD_FORM_SUBMISSION_NEUTRAL_NOTICE_MESSAGE,
  resolveLeadFormSubmissionCardNotice,
} from "./lead-form-submission-card-notice"

describe("resolveLeadFormSubmissionCardNotice", () => {
  it("não exibe aviso quando o lead foi criado/anexado com sucesso, mesmo com errorMessage interno", () => {
    const notice = resolveLeadFormSubmissionCardNotice({
      leadId: "lead-1",
      errorMessage: "E-mail não informado (lead criado com telefone)",
    })

    expect(notice).toEqual({ kind: "none" })
  })

  it("mostra estado neutro (sem o texto cru) quando a submissão foi descartada de fato", () => {
    const notice = resolveLeadFormSubmissionCardNotice({
      leadId: null,
      errorMessage: "Nome ausente; E-mail ausente",
    })

    expect(notice).toEqual({ kind: "neutral", message: LEAD_FORM_SUBMISSION_NEUTRAL_NOTICE_MESSAGE })
  })

  it("nunca repassa o texto cru do errorMessage no estado neutro", () => {
    const rawMessage = "Nome ausente; E-mail ausente"
    const notice = resolveLeadFormSubmissionCardNotice({ leadId: undefined, errorMessage: rawMessage })

    expect(notice.kind).toBe("neutral")
    if (notice.kind === "neutral") {
      expect(notice.message).not.toBe(rawMessage)
      expect(notice.message).not.toContain(rawMessage)
    }
  })

  it("não exibe nada quando não há errorMessage, com ou sem leadId", () => {
    expect(resolveLeadFormSubmissionCardNotice({ leadId: null, errorMessage: null })).toEqual({
      kind: "none",
    })
    expect(resolveLeadFormSubmissionCardNotice({ leadId: "lead-1", errorMessage: undefined })).toEqual({
      kind: "none",
    })
  })
})
