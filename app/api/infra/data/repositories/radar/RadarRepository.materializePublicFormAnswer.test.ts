import { beforeEach, describe, expect, it, mock } from "bun:test"

const profileFindFirstMock = mock(async () => null as Record<string, unknown> | null)
const profileUpdateMock = mock(async () => ({}))
const executeRawMock = mock(async () => 0)
const identityFindUniqueMock = mock(async () => null as { profileId: string } | null)
const identityUpdateManyMock = mock(async () => ({ count: 0 }))
const identityUpsertMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        radarProfile: { findFirst: profileFindFirstMock, update: profileUpdateMock },
        radarIdentity: {
          findUnique: identityFindUniqueMock,
          updateMany: identityUpdateManyMock,
          upsert: identityUpsertMock,
        },
        $executeRaw: executeRawMock,
      }),
  },
  withPrismaRetry: async <T>(fn: () => Promise<T>) => fn(),
}))

const { RadarRepository } = await import("./RadarRepository")

const EVENT_ID = "0ef8dd3a-8a61-4bd4-9ef3-682d3c144254"

const baseInput = {
  teamId: "team-1",
  profileId: "profile-1",
  formId: "form-1",
  publicationId: "publication-1",
  questionId: "q-phone",
  value: "(11) 98888-7777",
  mappingKey: "phone",
  answeredAt: new Date("2026-08-21T10:05:00.000Z"),
  sourceEventId: EVENT_ID,
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    profileData: null,
    primaryEmail: null,
    normalizedName: "",
    normalizedPhone: null,
    normalizedPrimaryEmail: null,
    ...overrides,
  }
}

describe("RadarRepository.materializePublicFormAnswer", () => {
  beforeEach(() => {
    profileFindFirstMock.mockReset()
    profileUpdateMock.mockReset()
    executeRawMock.mockReset()
    identityFindUniqueMock.mockReset()
    identityUpdateManyMock.mockReset()
    identityUpsertMock.mockReset()
    identityFindUniqueMock.mockResolvedValue(null)
    identityUpdateManyMock.mockResolvedValue({ count: 0 })
    identityUpsertMock.mockResolvedValue({})
    profileFindFirstMock.mockResolvedValue(profile())
    profileUpdateMock.mockResolvedValue({})
    executeRawMock.mockResolvedValue(0)
  })

  it("adquire o lock do perfil antes de ler a projeção", async () => {
    await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(executeRawMock).toHaveBeenCalled()
    expect(profileFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "profile-1", teamId: "team-1" } }),
    )
  })

  it("sinaliza mudança de identidade mesmo quando a resolução já gravou o telefone na linha", async () => {
    // `resolveProfileForPhone` grava `normalizedPhone` antes desta transação;
    // comparar coluna aqui faria o gate nunca rodar para telefone/e-mail.
    profileFindFirstMock.mockResolvedValue(profile({ normalizedPhone: "5511988887777" }))

    const result = await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(result.outcome).toBe("applied")
    expect(result.identityChanged).toBe("phone")
  })

  it("valor idêntico vindo de outro evento não reexecuta o gate", async () => {
    profileFindFirstMock.mockResolvedValue(
      profile({
        profileData: {
          publicForms: {
            "form-1": {
              publicationId: "publication-1",
              answers: {
                "q-phone": {
                  value: "(11) 98888-7777",
                  mappingKey: "phone",
                  answeredAt: "2026-08-21T10:00:00.000Z",
                  sourceEventId: "1a2b3c4d-1111-4aaa-bbbb-c5a4f3f5d001",
                },
              },
            },
          },
        },
      }),
    )

    const result = await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(result.outcome).toBe("unchanged")
    expect(result.identityChanged).toBeNull()
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })

  it("retry do mesmo evento reexecuta o gate sem reescrever a projeção", async () => {
    // Sem isto, um gate que falhou tecnicamente após a materialização deixaria
    // o perfil elegível sem lead: o retry veria "unchanged" e pularia o gate.
    profileFindFirstMock.mockResolvedValue(
      profile({
        profileData: {
          publicForms: {
            "form-1": {
              publicationId: "publication-1",
              answers: {
                "q-phone": {
                  value: "(11) 98888-7777",
                  mappingKey: "phone",
                  answeredAt: "2026-08-21T10:05:00.000Z",
                  sourceEventId: EVENT_ID,
                },
              },
            },
          },
        },
      }),
    )

    const result = await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(result.outcome).toBe("unchanged")
    expect(result.identityChanged).toBe("phone")
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })

  it("revisão atrasada não sobrescreve a projeção mais nova", async () => {
    profileFindFirstMock.mockResolvedValue(
      profile({
        profileData: {
          publicForms: {
            "form-1": {
              publicationId: "publication-1",
              answers: {
                "q-phone": {
                  value: "(11) 97777-6666",
                  mappingKey: "phone",
                  answeredAt: "2026-08-21T10:10:00.000Z",
                  sourceEventId: "9c9c9c9c-2222-4bbb-cccc-c5a4f3f5d003",
                },
              },
            },
          },
        },
      }),
    )

    const result = await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(result.outcome).toBe("stale")
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })

  it("resposta não identitária materializa sem sinalizar o gate", async () => {
    const result = await new RadarRepository().materializePublicFormAnswer({
      ...baseInput,
      questionId: "q-plano",
      mappingKey: null,
      value: ["individual", "familiar"],
    })

    expect(result.outcome).toBe("applied")
    expect(result.identityChanged).toBeNull()
    expect(profileUpdateMock).toHaveBeenCalledTimes(1)
  })

  it("e-mail respondido diferente do atual pede reconciliação", async () => {
    profileFindFirstMock.mockResolvedValue(
      profile({ normalizedPrimaryEmail: "campanha@gmail.com", primaryEmail: "campanha@gmail.com" }),
    )

    const result = await new RadarRepository().materializePublicFormAnswer({
      ...baseInput,
      questionId: "q-email",
      mappingKey: "email",
      value: "Ana@Gmail.com",
    })

    expect(result.identityChanged).toBe("email")
    expect(result.emailChange).toEqual({
      previousNormalizedEmail: "campanha@gmail.com",
      nextEmail: "Ana@Gmail.com",
      nextNormalizedEmail: "ana@gmail.com",
    })
  })

  it("e-mail já resolvido na linha não repete a reconciliação", async () => {
    profileFindFirstMock.mockResolvedValue(
      profile({ normalizedPrimaryEmail: "ana@gmail.com", primaryEmail: "ana@gmail.com" }),
    )

    const result = await new RadarRepository().materializePublicFormAnswer({
      ...baseInput,
      questionId: "q-email",
      mappingKey: "email",
      value: "Ana@Gmail.com",
    })

    expect(result.identityChanged).toBe("email")
    expect(result.emailChange).toBeNull()
  })

  it("cria a RadarIdentity do telefone projetado, sem depender do resolver", async () => {
    // Perfil resolvido por lead_id nunca passa por `resolveProfileForPhone`;
    // sem esta identidade, uma resolução futura criaria um perfil duplicado.
    await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(identityUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId_type_normalizedValue: {
            teamId: "team-1",
            type: "phone",
            normalizedValue: "5511988887777",
          },
        },
        create: expect.objectContaining({ profileId: "profile-1", isPrimary: true }),
      }),
    )
    expect(identityUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPrimary: false } }),
    )
  })

  it("não rouba a identidade quando o valor já pertence a outro perfil", async () => {
    identityFindUniqueMock.mockResolvedValue({ profileId: "outro-perfil" })

    await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(identityUpsertMock).not.toHaveBeenCalled()
    expect(identityUpdateManyMock).not.toHaveBeenCalled()
  })

  it("resposta de nome não cria identidade de contato", async () => {
    await new RadarRepository().materializePublicFormAnswer({
      ...baseInput,
      questionId: "q-name",
      mappingKey: "name",
      value: "Ana",
    })

    expect(identityUpsertMock).not.toHaveBeenCalled()
  })

  it("perfil inexistente não escreve nada", async () => {
    profileFindFirstMock.mockResolvedValue(null)

    const result = await new RadarRepository().materializePublicFormAnswer(baseInput)

    expect(result.outcome).toBe("profile_not_found")
    expect(profileUpdateMock).not.toHaveBeenCalled()
  })
})
