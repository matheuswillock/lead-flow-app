import { describe, expect, it } from "bun:test"
import { resolvePublicFormLeadAssignment } from "@/lib/public-forms/resolve-public-form-lead-assignment"

describe("resolvePublicFormLeadAssignment", () => {
  it("sem assignedSdrId no form → sem SDR/closer", () => {
    expect(resolvePublicFormLeadAssignment({ assignedSdrId: null })).toEqual({
      assignedTo: undefined,
      closerId: undefined,
    })
  })

  it("com assignedSdrId no form → SDR do form, sem closer", () => {
    const sdrId = "4ad47884-7b56-46c7-ac22-7b8285267140"
    expect(resolvePublicFormLeadAssignment({ assignedSdrId: sdrId })).toEqual({
      assignedTo: sdrId,
      closerId: undefined,
    })
  })
})
