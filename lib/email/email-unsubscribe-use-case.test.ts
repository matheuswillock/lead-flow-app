import { describe, expect, it, mock, beforeEach } from "bun:test"
import { generateEmailUnsubscribeToken } from "@/lib/email/unsubscribe-token"

const findFirstMock = mock(async () => null as Record<string, unknown> | null)
const updateMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContact: {
      findFirst: findFirstMock,
      update: updateMock,
    },
  },
}))

const { EmailUnsubscribeUseCase } = await import("@/app/api/useCases/email/EmailUnsubscribeUseCase")

describe("EmailUnsubscribeUseCase", () => {
  const useCase = new EmailUnsubscribeUseCase()

  beforeEach(() => {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret-for-unsubscribe"
    findFirstMock.mockClear()
    updateMock.mockClear()
  })

  it("rejeita token inválido", async () => {
    const output = await useCase.unsubscribe("token-invalido")
    expect(output.isValid).toBe(false)
  })

  it("marca contato como descadastrado com token válido", async () => {
    const contactId = "11111111-1111-4111-8111-111111111111"
    const teamId = "22222222-2222-4222-8222-222222222222"
    const token = generateEmailUnsubscribeToken(contactId, teamId)

    findFirstMock.mockResolvedValueOnce({ id: contactId, isUnsubscribed: false })

    const output = await useCase.unsubscribe(token)
    expect(output.isValid).toBe(true)
    expect(updateMock).toHaveBeenCalled()
  })

  it("getInfo retorna link inválido para token malformado", async () => {
    const output = await useCase.getInfo("bad-token")
    expect(output.isValid).toBe(false)
  })
})
