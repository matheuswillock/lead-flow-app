import { describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

/**
 * Bug 2026-09-03 (caso PIMENTAS/KKJ): `resolveProfileForEmail` só olhava a
 * `RadarIdentity` exclusiva do e-mail. Perfis criados por
 * `resolveProfileForPhone` (import de base, carteira) ficavam com
 * `normalizedPrimaryEmail` preenchido na COLUNA do `RadarProfile` mas SEM
 * essa claim exclusiva — um contato de e-mail chegando depois nunca
 * encontrava o dono e criava um segundo perfil para a mesma pessoa (3.163
 * pares medidos em produção, caso exato: perfil com telefone criado às
 * 17:22, perfil sem telefone para o MESMO e-mail criado às 17:31).
 *
 * Estes testes travam o fallback por coluna + a guarda de e-mail
 * compartilhado descrita em `lib/radar/email-profile-match.ts`.
 */

const executeRawMock = mock(async () => 0)
const radarIdentityFindUniqueMock = mock(async () => null as { profileId: string } | null)
const radarIdentityUpsertMock = mock(async (args: unknown) => args)
const radarProfileFindFirstMock = mock(
  async () =>
    null as {
      id: string
      displayName: string
      normalizedName: string
      normalizedPhone: string | null
    } | null
)
const radarProfileUpdateMock = mock(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
  id: args.where.id,
  ...args.data,
}))
// `enrichEmailOnlyProfileWithTx` lê o displayName atual antes de decidir se
// herda o nome novo — devolve o mesmo `displayName` que o fallback por
// coluna já enxergou, então os testes não precisam duplicar o fixture.
const radarProfileFindUniqueMock = mock(async (args: { where: { id: string } }) => {
  const found = lastColumnCandidate && lastColumnCandidate.id === args.where.id ? lastColumnCandidate : null
  return found ? { displayName: found.displayName } : null
})
let lastColumnCandidate: { id: string; displayName: string } | null = null
const radarProfileCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "profile-novo",
  ...args.data,
}))
const radarEventCreateMock = mock(async () => ({}))
const radarIdentityCreateMock = mock(async () => ({}))

const tx = {
  $executeRaw: executeRawMock,
  radarIdentity: {
    findUnique: radarIdentityFindUniqueMock,
    upsert: radarIdentityUpsertMock,
    create: radarIdentityCreateMock,
  },
  radarProfile: {
    findFirst: radarProfileFindFirstMock,
    findUnique: radarProfileFindUniqueMock,
    update: radarProfileUpdateMock,
    create: radarProfileCreateMock,
  },
  radarEvent: { create: radarEventCreateMock },
}

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
})

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

function resolveWith(input: { displayName: string | null; normalizedName: string | null }) {
  return new RadarRepository().resolveProfileForEmail({
    teamId: "team-1",
    normalizedEmail: "matriz@idgt.org.br",
    emailValue: "matriz@idgt.org.br",
    displayName: input.displayName,
    normalizedName: input.normalizedName,
    emailSource: "email_contact",
  })
}

function setColumnCandidate(
  candidate: {
    id: string
    displayName: string
    normalizedName: string
    normalizedPhone: string | null
  } | null
) {
  lastColumnCandidate = candidate
  radarProfileFindFirstMock.mockResolvedValue(candidate)
}

function resetMocks() {
  radarIdentityFindUniqueMock.mockClear()
  radarIdentityFindUniqueMock.mockResolvedValue(null)
  radarIdentityUpsertMock.mockClear()
  radarProfileFindFirstMock.mockClear()
  radarProfileFindUniqueMock.mockClear()
  radarProfileUpdateMock.mockClear()
  radarProfileCreateMock.mockClear()
  radarEventCreateMock.mockClear()
  radarIdentityCreateMock.mockClear()
  setColumnCandidate(null)
}

describe("resolveProfileForEmail — fallback por coluna quando não há RadarIdentity exclusiva", () => {
  it("candidato com nome IGUAL (caso PIMENTAS) → enriquece o perfil existente e finalmente reivindica a RadarIdentity", async () => {
    resetMocks()
    setColumnCandidate({
      id: "profile-729da282",
      displayName: "PIMENTAS BETA",
      normalizedName: "pimentas beta",
      normalizedPhone: "5512988821371",
    })

    const result = await resolveWith({ displayName: "PIMENTAS BETA", normalizedName: "pimentas beta" })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(true)
    // Enriquece o MESMO perfil (não cria um segundo).
    expect(radarProfileCreateMock).not.toHaveBeenCalled()
    expect(radarProfileUpdateMock).toHaveBeenCalledTimes(1)
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-729da282" },
    })
    // Fecha a lacuna: agora reivindica a claim exclusiva para este perfil.
    expect(radarIdentityUpsertMock).toHaveBeenCalledTimes(1)
    const upsertArgs = radarIdentityUpsertMock.mock.calls[0]?.[0] as {
      create: { profileId: string }
      update: { profileId: string }
    }
    expect(upsertArgs.create.profileId).toBe("profile-729da282")
    expect(upsertArgs.update.profileId).toBe("profile-729da282")
  })

  it("candidato sem nome usável (placeholder = o próprio e-mail) → enriquece mesmo com nome novo divergente", async () => {
    resetMocks()
    setColumnCandidate({
      id: "profile-email-only",
      displayName: "matriz@idgt.org.br",
      normalizedName: "matriz@idgt.org.br",
      normalizedPhone: null,
    })

    const result = await resolveWith({ displayName: "Alguém Novo", normalizedName: "alguem novo" })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(true)
    expect(radarProfileCreateMock).not.toHaveBeenCalled()
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-email-only" },
      data: { displayName: "Alguém Novo", normalizedName: "alguem novo" },
    })
  })

  it("guarda de e-mail compartilhado: candidato com nome e telefone PRÓPRIOS divergentes → cria perfil separado e NÃO rouba a RadarIdentity", async () => {
    resetMocks()
    setColumnCandidate({
      id: "profile-dono-original",
      displayName: "Maria Silva",
      normalizedName: "maria silva",
      normalizedPhone: "5511988887777",
    })

    const result = await resolveWith({ displayName: "João Pereira", normalizedName: "joao pereira" })

    expect(result.wasExisting).toBe(false)
    expect(result.emailIdentityClaimed).toBe(false)
    expect(result.profile.id).toBe("profile-novo")
    // NUNCA atualiza o perfil do dono original.
    expect(radarProfileUpdateMock).not.toHaveBeenCalled()
    // NUNCA reivindica/rouba a RadarIdentity do e-mail compartilhado.
    expect(radarIdentityUpsertMock).not.toHaveBeenCalled()
    expect(radarIdentityCreateMock).not.toHaveBeenCalled()
    // Ainda assim cria o perfil separado (é gente diferente, não descarta o contato).
    expect(radarProfileCreateMock).toHaveBeenCalledTimes(1)
  })

  it("nenhum candidato por identidade nem por coluna → cria normalmente e reivindica a RadarIdentity (comportamento original intacto)", async () => {
    resetMocks()

    const result = await resolveWith({ displayName: "Novo Contato", normalizedName: "novo contato" })

    expect(result.wasExisting).toBe(false)
    expect(result.emailIdentityClaimed).toBe(true)
    expect(radarProfileCreateMock).toHaveBeenCalledTimes(1)
    expect(radarIdentityCreateMock).toHaveBeenCalledTimes(1)
  })
})
