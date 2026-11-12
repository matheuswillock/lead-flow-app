import { describe, expect, it } from "bun:test"
import { buildNotificationPath, hasTeamExportDownloadLink } from "./build-notification-url"

describe("notificação da exportação do time", () => {
  const href = "/api/q/teams/exports/job-1/download"

  it("TEAM_EXPORT_READY leva direto ao download", () => {
    expect(buildNotificationPath({ supabaseId: "u1", type: "TEAM_EXPORT_READY", metadata: { href } })).toBe(href)
  })

  it("ignora href fora da rota de exportação (não vira redirecionamento aberto)", () => {
    const metadata = { href: "https://evil.test/x" }
    expect(hasTeamExportDownloadLink("TEAM_EXPORT_READY", metadata)).toBe(false)
    expect(buildNotificationPath({ supabaseId: "u1", type: "TEAM_EXPORT_READY", metadata })).toBe("/u1/notifications")
  })

  it("TEAM_EXPORT_FAILED abre a central de notificações", () => {
    expect(buildNotificationPath({ supabaseId: "u1", type: "TEAM_EXPORT_FAILED", metadata: { href } })).toBe(
      "/u1/notifications",
    )
  })
})
