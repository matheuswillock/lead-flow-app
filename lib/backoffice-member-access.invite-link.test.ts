import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { verifyInviteLinkToken } from "@/lib/auth/invite-link-token"
import { generateInviteActionLink } from "./backoffice-member-access"

const SECRET = "test-secret-with-at-least-32-characters-x"
const profile = {
  profileId: "profile-1",
  supabaseId: null,
  email: "Ana@Example.com",
  fullName: "Ana Souza",
  role: "operator" as const,
}

describe("generateInviteActionLink (link de convite reutilizável)", () => {
  let previousSecret: string | undefined
  let previousAppUrl: string | undefined

  beforeEach(() => {
    previousSecret = process.env.INVITE_LINK_SECRET
    process.env.INVITE_LINK_SECRET = SECRET
    previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test"
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.INVITE_LINK_SECRET
    else process.env.INVITE_LINK_SECRET = previousSecret
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
  })

  it("gera link com token assinado, perfil e versão, sem token_hash do Supabase", () => {
    const { actionLink, displayName } = generateInviteActionLink(profile, 4)
    const url = new URL(actionLink)

    expect(url.pathname).toBe("/set-password")
    expect(url.searchParams.has("token_hash")).toBe(false)
    expect(displayName).toBe("Ana Souza")

    const payload = verifyInviteLinkToken(url.searchParams.get("invite") ?? "", { secret: SECRET })
    expect(payload?.email).toBe("ana@example.com")
    expect(payload?.name).toBe("Ana Souza")
    expect(payload?.profileId).toBe("profile-1")
    expect(payload?.inviteLinkVersion).toBe(4)
  })

  it("gerar de novo não invalida o anterior: ambos verificam", () => {
    const first = new URL(generateInviteActionLink(profile, 4).actionLink).searchParams.get("invite") ?? ""
    const second = new URL(generateInviteActionLink(profile, 4).actionLink).searchParams.get("invite") ?? ""

    expect(verifyInviteLinkToken(first, { secret: SECRET })).not.toBeNull()
    expect(verifyInviteLinkToken(second, { secret: SECRET })).not.toBeNull()
  })
})
