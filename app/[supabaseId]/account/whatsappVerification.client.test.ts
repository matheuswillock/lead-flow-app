import { describe, expect, it } from "bun:test"
import {
  buildWhatsAppAccountPath,
  getAccountReturnPath,
  hasVerifiedWhatsAppContact,
  shouldShowWhatsAppVerificationPrompt,
} from "./whatsappVerification.client"

const profileId = "123e4567-e89b-12d3-a456-426614174000"

describe("account WhatsApp verification client rules", () => {
  it("requires a dedicated WhatsApp phone and verification timestamp", () => {
    expect(hasVerifiedWhatsAppContact({ phone: "+5511999999999" })).toBe(false)
    expect(hasVerifiedWhatsAppContact({ whatsappPhone: "+5511999999999" })).toBe(false)
    expect(
      hasVerifiedWhatsAppContact({
        whatsappPhone: "+5511999999999",
        whatsappPhoneVerifiedAt: "2026-11-23T12:00:00.000Z",
      }),
    ).toBe(true)
  })

  it("keeps the requested app route only when it belongs to the active profile", () => {
    expect(getAccountReturnPath(`/${profileId}/crm?board=active`, profileId)).toBe(
      `/${profileId}/crm`,
    )
    expect(getAccountReturnPath("/another-profile/crm", profileId)).toBeNull()
    expect(getAccountReturnPath("//outside.example", profileId)).toBeNull()
  })

  it("opens the post-login prompt only for loaded, unverified users outside account settings", () => {
    const unverified = { supabaseId: profileId, whatsappPhone: "+5511999999999", whatsappPhoneVerifiedAt: null }
    expect(shouldShowWhatsAppVerificationPrompt(unverified, false, `/${profileId}/crm`, profileId)).toBe(true)
    expect(shouldShowWhatsAppVerificationPrompt({ ...unverified, supabaseId: "other-profile" }, false, `/${profileId}/crm`, profileId)).toBe(false)
    expect(shouldShowWhatsAppVerificationPrompt(unverified, true, `/${profileId}/crm`, profileId)).toBe(false)
    expect(shouldShowWhatsAppVerificationPrompt(unverified, false, `/${profileId}/account`, profileId)).toBe(false)
    expect(shouldShowWhatsAppVerificationPrompt({ supabaseId: profileId, whatsappPhone: "+5511999999999", whatsappPhoneVerifiedAt: "now" }, false, `/${profileId}/crm`, profileId)).toBe(false)
  })

  it("creates an account URL carrying only a validated same-profile return path", () => {
    const destination = getAccountReturnPath(`/${profileId}/crm?board=active`, profileId)
    expect(buildWhatsAppAccountPath(profileId, destination)).toBe(`/${profileId}/account?returnTo=%2F${profileId}%2Fcrm`)
    expect(buildWhatsAppAccountPath(profileId, getAccountReturnPath("//outside.example", profileId))).toBe(`/${profileId}/account`)
  })
})
