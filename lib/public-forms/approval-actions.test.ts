import { describe, expect, test } from "bun:test"
import { canRequestPublicFormApproval } from "./approval-actions"

describe("canRequestPublicFormApproval", () => {
  test("não oferece aprovação quando a governança do time está desativada", () => {
    expect(canRequestPublicFormApproval({ canEdit: true, approvalRequired: false, status: "draft" })).toBe(false)
  })

  test("oferece aprovação para rascunho quando a governança está ativa", () => {
    expect(canRequestPublicFormApproval({ canEdit: true, approvalRequired: true, status: "draft" })).toBe(true)
  })
})
