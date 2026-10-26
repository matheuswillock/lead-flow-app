import { describe, expect, it } from "bun:test"
import { shouldShowLeadFormsTab } from "./lead-forms-tab-visibility"

describe("shouldShowLeadFormsTab", () => {
  it("mostra a aba quando o plano libera formulários públicos", () => {
    expect(shouldShowLeadFormsTab(true)).toBe(true)
  })

  it("oculta a aba quando o plano CRM não inclui formulários públicos", () => {
    expect(shouldShowLeadFormsTab(false)).toBe(false)
  })
})
