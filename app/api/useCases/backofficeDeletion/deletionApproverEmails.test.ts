import { describe, expect, it } from "bun:test"
import {
  BACKOFFICE_DELETION_APPROVER_EMAILS,
  isBackofficeDeletionApproverEmail,
} from "./deletionApproverEmails"

describe("deletionApproverEmails", () => {
  it("expõe exatamente os dois aprovadores corretos", () => {
    expect(BACKOFFICE_DELETION_APPROVER_EMAILS).toEqual([
      "matheuswillock@corretorstudio.com.br",
      "bruno@corretorstudio.com.br",
    ])
  })

  it("aceita e-mails autorizados sem diferenciar maiúsculas", () => {
    expect(isBackofficeDeletionApproverEmail("MatheusWillock@CorretorStudio.com.br")).toBe(true)
    expect(isBackofficeDeletionApproverEmail("  bruno@corretorstudio.com.br  ")).toBe(true)
  })

  it("rejeita e-mails não autorizados", () => {
    expect(isBackofficeDeletionApproverEmail("ops@corretorstudio.com.br")).toBe(false)
    expect(isBackofficeDeletionApproverEmail("bruno@onsidemarketing.com.br")).toBe(false)
    expect(isBackofficeDeletionApproverEmail("")).toBe(false)
  })
})
