import { describe, expect, it } from "bun:test"
import { createProfileResponseDTO } from "./profileResponseDTO"

const verifiedAt = new Date("2026-11-23T12:34:56.000Z")

function createProfile() {
  return {
    id: "profile-1",
    email: "broker@example.test",
    supabaseId: "5b36cd1a-898b-4545-b8ed-97469fd24a34",
    phone: "(11) 3333-4444",
    whatsappPhone: "+5511999999999",
    whatsappPhoneVerifiedAt: verifiedAt,
    fullName: "Corretor Teste",
    cpfCnpj: null,
    postalCode: null,
    address: null,
    addressNumber: null,
    neighborhood: null,
    complement: null,
    city: null,
    state: null,
    role: "manager" as const,
    functions: [],
    isMaster: false,
    managerId: null,
    profileIconId: null,
    profileIconUrl: null,
    googleConnection: null,
    subscriptionId: null,
    subscriptionStatus: null,
    activeTeamId: null,
    createdAt: verifiedAt,
    updatedAt: verifiedAt,
    operators: [],
  }
}

describe("createProfileResponseDTO WhatsApp contact", () => {
  it("returns the verified contact only on the current profile, not associated users", () => {
    const result = createProfileResponseDTO(createProfile())

    expect(result.whatsappPhone).toBe("+5511999999999")
    expect(result.whatsappPhoneVerifiedAt).toBe(verifiedAt.toISOString())
    expect(result.usersAssociated[0]).not.toHaveProperty("whatsappPhone")
    expect(result.usersAssociated[0]).not.toHaveProperty("whatsappPhoneVerifiedAt")
  })

  it("returns null when the profile has no WhatsApp contact", () => {
    const profile = { ...createProfile(), whatsappPhone: null, whatsappPhoneVerifiedAt: null }
    const result = createProfileResponseDTO(profile)

    expect(result.whatsappPhone).toBeNull()
    expect(result.whatsappPhoneVerifiedAt).toBeNull()
  })
})
