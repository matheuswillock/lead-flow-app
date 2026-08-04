import { describe, expect, it } from "bun:test"
import { parseRadarProfilesExportQuery } from "@/lib/radar/parseRadarProfilesExportQuery"

describe("parseRadarProfilesExportQuery", () => {
  it("aceita filtros válidos", () => {
    const params = new URLSearchParams({
      search: "ana",
      consent: "allowed",
      sourceType: "crm_lead",
      channel: "email",
      lastSeenFrom: "2026-01-01T00:00:00.000Z",
      lastSeenTo: "2026-08-01T00:00:00.000Z",
    })
    const parsed = parseRadarProfilesExportQuery(params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.consent).toBe("allowed")
    expect(parsed.value.sourceType).toBe("crm_lead")
    expect(parsed.value.channel).toBe("email")
  })

  it("rejeita consent, sourceType, channel e datas inválidos", () => {
    expect(parseRadarProfilesExportQuery(new URLSearchParams({ consent: "maybe" })).ok).toBe(false)
    expect(parseRadarProfilesExportQuery(new URLSearchParams({ sourceType: "email_log" })).ok).toBe(false)
    expect(parseRadarProfilesExportQuery(new URLSearchParams({ channel: "sms" })).ok).toBe(false)
    expect(parseRadarProfilesExportQuery(new URLSearchParams({ lastSeenFrom: "not-a-date" })).ok).toBe(false)
    expect(parseRadarProfilesExportQuery(new URLSearchParams({ lastSeenTo: "32/13/2026" })).ok).toBe(false)
  })
})
