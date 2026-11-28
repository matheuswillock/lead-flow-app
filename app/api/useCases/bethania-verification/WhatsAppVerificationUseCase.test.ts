import { describe, expect, it, mock } from "bun:test"
mock.module("server-only", () => ({}))
const { WhatsAppVerificationUseCase } = await import("./WhatsAppVerificationUseCase")

const PHONE = "+15550101234"
function setup(getSenderUrl: () => Promise<string | null> = async () => "https://configured-backoffice.example/") {
  const profile = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    whatsappPhone: null as string | null,
    whatsappPhoneVerifiedAt: null as Date | null,
  }
  const challenge = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    profileId: profile.id,
    phone: PHONE,
    codeHash: "",
    expiresAt: new Date("2026-11-23T16:10:00.000Z"),
    attempts: 0,
    consumedAt: null as Date | null,
    createdAt: new Date("2026-11-23T16:00:00.000Z"),
  }
  const challengeRepo = {
    findMany: mock(async (_args?: any) => [] as { createdAt: Date }[]),
    create: mock(async ({ data }: any) => Object.assign(challenge, data)),
    update: mock(async ({ data }: any) => Object.assign(challenge, data)),
    updateMany: mock(async ({ data }: any) => {
      if (data.attempts?.increment) challenge.attempts += data.attempts.increment
      if (data.consumedAt) challenge.consumedAt = data.consumedAt
      return { count: 1 }
    }),
    findUnique: mock(async () => challenge),
  }
  const tx = {
    profile: {
      findUnique: mock(async ({ where }: any) => (where.supabaseId === "user-1" ? profile : null)),
      updateMany: mock(async (_args?: any) => ({ count: 1 })),
    },
    bethaniaVerificationChallenge: challengeRepo,
    $queryRaw: mock(async () => []),
  }
  const db = { ...tx, $transaction: mock(async (callback: any) => callback(tx)) }
  const repository = {
    issueChallenge: mock(async (input: any) => {
      if (input.supabaseId !== "user-1") return null
      const recent = await challengeRepo.findMany()
      if (recent.length >= 3) return null
      const record = await challengeRepo.create({ data: {
        id: input.id,
        profileId: profile.id,
        phone: input.phone,
        codeHash: input.codeHash,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      } })
      return { id: record.id, profileId: record.profileId, phone: record.phone }
    }),
    invalidateChallenge: mock(async (_id: string, now: Date) => {
      await challengeRepo.updateMany({ data: { consumedAt: now } })
    }),
    findChallenge: mock(async (supabaseId: string, id: string) =>
      supabaseId === "user-1" && id === challenge.id ? challengeRepo.findUnique() : null,
    ),
    incrementFailedAttempt: mock(async (input: { maxAttempts: number }) => {
      if (challenge.attempts < input.maxAttempts) {
        await challengeRepo.updateMany({ data: { attempts: { increment: 1 } } })
      }
    }),
    consumeAndSetPhone: mock(async (input: any) => {
      await challengeRepo.updateMany({ data: { consumedAt: input.now } })
      await tx.profile.updateMany({
        where: { id: profile.id },
        data: { whatsappPhone: input.phone, whatsappPhoneVerifiedAt: input.now },
      })
      return true
    }),
  }
  const sender = mock(async () => ({ accepted: true as const }))
  const useCase = new WhatsAppVerificationUseCase(repository as any, sender, {
    secret: "12345678901234567890123456789012",
    now: () => new Date("2026-11-23T16:00:00Z"),
    randomCode: () => "123456",
    randomChallengeId: () => challenge.id,
    getSenderUrl,
  })
  return { useCase, tx, sender, challenge, repository, profile }
}

describe("WhatsApp verification use case", () => {
  it("persists only an HMAC hash and sends the OTP to the bound E.164 phone", async () => {
    const { useCase, repository, sender, challenge } = setup()
    const result = await useCase.requestCode("user-1", PHONE)
    expect(result).toEqual({ ok: true, challengeId: challenge.id })
    expect(JSON.stringify(result)).not.toContain("123456")
    expect(challenge.codeHash).not.toContain("123456")
    expect(repository.issueChallenge).toHaveBeenCalled()
    expect(sender).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "account.whatsapp_verification",
        eventId: challenge.id,
        phone: PHONE,
        message: expect.stringContaining("123456"),
      }),
      expect.objectContaining({ baseUrl: "https://configured-backoffice.example/" }),
    )
  })

  it("does not fall back to BETHANIA_SENDER_URL when backoffice has no sender URL", async () => {
    const { useCase, sender, challenge } = setup(async () => null)
    const previousUrl = process.env.BETHANIA_SENDER_URL
    process.env.BETHANIA_SENDER_URL = "https://env-only.example/"

    try {
      const result = await useCase.requestCode("user-1", PHONE)
      expect(result).toEqual({
        ok: false,
        message: "Não foi possível enviar o código. Tente novamente.",
        status: 503,
      })
      expect(sender).not.toHaveBeenCalled()
      expect(challenge.consumedAt).not.toBeNull()
    } finally {
      if (previousUrl === undefined) delete process.env.BETHANIA_SENDER_URL
      else process.env.BETHANIA_SENDER_URL = previousUrl
    }
  })

  it("does not expose or leave a usable challenge when delivery fails", async () => {
    const { useCase, sender, challenge } = setup()
    sender.mockRejectedValueOnce(new Error("transport unavailable"))
    const result = await useCase.requestCode("user-1", PHONE)
    expect(result.ok).toBe(false)
    expect("message" in result ? result.message : null).toBe(
      "Não foi possível enviar o código. Tente novamente.",
    )
    expect(challenge.consumedAt).not.toBeNull()
  })

  it("returns the standard Output contract without exposing the OTP", async () => {
    const { useCase } = setup()
    const output = await useCase.execute({ action: "request-code", supabaseId: "user-1", phone: PHONE })
    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ challengeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: 202 })
    expect(JSON.stringify(output)).not.toContain("123456")
  })

  it("verifies a correct code and stores the verified WhatsApp number", async () => {
    const { useCase, tx, challenge, profile } = setup()
    const request = await useCase.requestCode("user-1", PHONE)
    expect(request.ok).toBe(true)
    const result = await useCase.verifyCode("user-1", challenge.id, "123456")
    expect(result.ok).toBe(true)
    expect(tx.profile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: profile.id },
        data: expect.objectContaining({ whatsappPhone: PHONE }),
      }),
    )
  })

  it("rejects a challenge for a different profile", async () => {
    const { useCase, challenge } = setup()
    const result = await useCase.verifyCode("other-user", challenge.id, "123456")
    expect(result.ok).toBe(false)
    expect("message" in result ? result.message : null).toBe("Código inválido ou expirado.")
  })

  it("increments failed attempts and locks out after five guesses", async () => {
    const { useCase, challenge } = setup()
    await useCase.requestCode("user-1", PHONE)
    for (let attempt = 0; attempt < 5; attempt++)
      await useCase.verifyCode("user-1", challenge.id, "000000")
    expect(challenge.attempts).toBe(5)
    expect((await useCase.verifyCode("user-1", challenge.id, "123456")).ok).toBe(false)
  })

  it("rejects expired challenges without setting a verified phone", async () => {
    const { useCase, tx, challenge } = setup()
    await useCase.requestCode("user-1", PHONE)
    challenge.expiresAt = new Date("2026-11-23T15:59:59Z")
    expect((await useCase.verifyCode("user-1", challenge.id, "123456")).ok).toBe(false)
    expect(tx.profile.updateMany).not.toHaveBeenCalled()
  })

  it("enforces the three-requests-per-hour profile limit", async () => {
    const { useCase, tx, sender } = setup()
    const now = new Date("2026-11-23T16:00:00Z")
    tx.bethaniaVerificationChallenge.findMany.mockResolvedValueOnce([
      { createdAt: new Date(now.getTime() - 30_000) },
      { createdAt: new Date(now.getTime() - 60_000) },
      { createdAt: new Date(now.getTime() - 90_000) },
    ] as any)
    expect((await useCase.requestCode("user-1", PHONE)).ok).toBe(false)
    expect(sender).not.toHaveBeenCalled()
  })
})
