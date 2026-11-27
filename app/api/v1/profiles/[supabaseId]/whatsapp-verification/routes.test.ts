import { beforeEach, describe, expect, it, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
mock.module("next/server", () => ({ NextRequest, NextResponse }))
const ownershipMock = mock(async (_request: NextRequest, id: string) => ({ supabaseId: id }) as any)
mock.module("@/app/api/v1/profiles/utils/assertProfileOwnership", () => ({
  assertProfileOwnership: ownershipMock,
}))
const executeMock = mock(async (input: { action: string }) => input.action === "request-code"
  ? new Output(true, [], [], { status: 202, challengeId: "challenge-id" })
  : new Output(true, [], [], { status: 200 }))
mock.module("@/app/api/useCases/bethania-verification/WhatsAppVerificationUseCase", () => ({
  whatsappVerificationUseCase: { execute: executeMock },
}))
const { POST: requestCode } = await import("./request-code/route")
const { POST: verifyCode } = await import("./verify-code/route")
const USER = "11111111-1111-4111-8111-111111111111"
const params = Promise.resolve({ supabaseId: USER })
function req(body?: unknown) {
  return new NextRequest(`http://localhost/api/v1/profiles/${USER}/whatsapp-verification`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

beforeEach(() => {
  ownershipMock.mockClear()
  executeMock.mockClear()
})

describe("profile-bound WhatsApp verification routes", () => {
  it("does not issue a code for an unauthenticated caller", async () => {
    ownershipMock.mockResolvedValueOnce({ error: {}, status: 401 } as any)
    const response = await requestCode(req({ phone: "+15551234567" }), { params })
    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("does not issue a code when the caller does not own the path profile", async () => {
    ownershipMock.mockResolvedValueOnce({ error: {}, status: 403 } as any)
    const response = await requestCode(req({ phone: "+15551234567" }), { params })
    expect(response.status).toBe(403)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it("routes code requests to the authenticated path profile", async () => {
    const response = await requestCode(req({ phone: "+15551234567" }), { params })
    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ success: true, challengeId: "challenge-id" })
    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({ action: "request-code", supabaseId: USER, phone: expect.any(String) }))
  })

  it("verifies using authenticated profile, challenge id, and code", async () => {
    const response = await verifyCode(req({ challengeId: "challenge-id", code: "123456" }), {
      params,
    })
    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledWith({ action: "verify-code", supabaseId: USER, challengeId: "challenge-id", code: "123456" })
  })

  it("rejects wrong profile verification before use case access", async () => {
    ownershipMock.mockResolvedValueOnce({ error: {}, status: 403 } as any)
    const response = await verifyCode(req({ challengeId: "challenge-id", code: "123456" }), {
      params,
    })
    expect(response.status).toBe(403)
    expect(executeMock).not.toHaveBeenCalled()
  })
})
