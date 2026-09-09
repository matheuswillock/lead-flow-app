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
 * compartilhado descrita em `lib/radar/email-profile-match.ts`, incluindo os
 * achados cursor/codex do PR #1155: (1) o fallback olha TODOS os candidatos
 * da coluna, não só o mais antigo; (2) o caminho por identidade também passa
 * pela guarda — dono estabelecido divergente nunca é enriquecido por um
 * contato de outra pessoa.
 */

type ProfileFixture = {
  id: string
  displayName: string | null
  normalizedName: string | null
  normalizedPhone: string | null
}

const executeRawMock = mock(async () => 0)
const radarIdentityFindUniqueMock = mock(async () => null as { profileId: string } | null)
const radarIdentityUpsertMock = mock(async (args: unknown) => args)
const radarIdentityCreateMock = mock(async () => ({}))

let profileFixtures: Record<string, ProfileFixture> = {}
let columnCandidates: ProfileFixture[] = []

// `resolveProfileForEmail` lê perfis por id em dois pontos (dados do dono da
// claim para a guarda; displayName atual em `enrichEmailOnlyProfileWithTx`) —
// devolve o fixture inteiro, superset dos dois selects.
const radarProfileFindUniqueMock = mock(async (args: { where: { id: string } }) => {
  return profileFixtures[args.where.id] ?? null
})
// Fallback por coluna: TODOS os candidatos da mesma caixa postal, honrando o
// `id: { not: ... }` usado para excluir o dono da claim.
const radarProfileFindManyMock = mock(async (args: { where: { id?: { not: string } } }) => {
  const excluded = args.where.id?.not
  return columnCandidates.filter((candidate) => candidate.id !== excluded)
})
const radarProfileUpdateMock = mock(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
  id: args.where.id,
  ...args.data,
}))
const radarProfileCreateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "profile-novo",
  ...args.data,
}))
const radarEventCreateMock = mock(async () => ({}))

const tx = {
  $executeRaw: executeRawMock,
  radarIdentity: {
    findUnique: radarIdentityFindUniqueMock,
    upsert: radarIdentityUpsertMock,
    create: radarIdentityCreateMock,
  },
  radarProfile: {
    findMany: radarProfileFindManyMock,
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

function setColumnCandidates(candidates: ProfileFixture[]) {
  columnCandidates = candidates
  for (const candidate of candidates) profileFixtures[candidate.id] = candidate
}

function setIdentityOwner(owner: ProfileFixture) {
  profileFixtures[owner.id] = owner
  radarIdentityFindUniqueMock.mockResolvedValue({ profileId: owner.id })
}

function resetMocks() {
  radarIdentityFindUniqueMock.mockClear()
  radarIdentityFindUniqueMock.mockResolvedValue(null)
  radarIdentityUpsertMock.mockClear()
  radarProfileFindManyMock.mockClear()
  radarProfileFindUniqueMock.mockClear()
  radarProfileUpdateMock.mockClear()
  radarProfileCreateMock.mockClear()
  radarEventCreateMock.mockClear()
  radarIdentityCreateMock.mockClear()
  profileFixtures = {}
  columnCandidates = []
}

describe("resolveProfileForEmail — fallback por coluna quando não há RadarIdentity exclusiva", () => {
  it("candidato com nome IGUAL (caso PIMENTAS) → enriquece o perfil existente e finalmente reivindica a RadarIdentity", async () => {
    resetMocks()
    setColumnCandidates([
      {
        id: "profile-729da282",
        displayName: "PIMENTAS BETA",
        normalizedName: "pimentas beta",
        normalizedPhone: "5512988821371",
      },
    ])

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
    setColumnCandidates([
      {
        id: "profile-email-only",
        displayName: "matriz@idgt.org.br",
        normalizedName: "matriz@idgt.org.br",
        normalizedPhone: null,
      },
    ])

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
    setColumnCandidates([
      {
        id: "profile-dono-original",
        displayName: "Maria Silva",
        normalizedName: "maria silva",
        normalizedPhone: "5511988887777",
      },
    ])

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

  it("achado codex #1155 (P2): candidato mais ANTIGO divergente não bloqueia — o compatível mais novo é enriquecido em vez de criar outro duplicado", async () => {
    resetMocks()
    setColumnCandidates([
      {
        id: "profile-antigo-divergente",
        displayName: "Maria Silva",
        normalizedName: "maria silva",
        normalizedPhone: "5511988887777",
      },
      {
        id: "profile-joao-secundario",
        displayName: "João Pereira",
        normalizedName: "joao pereira",
        normalizedPhone: "5511977776666",
      },
    ])

    const result = await resolveWith({ displayName: "João Pereira", normalizedName: "joao pereira" })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(true)
    // Enriquece o candidato COMPATÍVEL (nome idêntico), não o mais antigo.
    expect(radarProfileCreateMock).not.toHaveBeenCalled()
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-joao-secundario" },
    })
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

describe("resolveProfileForEmail — guarda também no caminho por RadarIdentity (achado codex #1155 P1)", () => {
  it("dono da claim compatível (mesmo nome) → enriquece o dono e mantém claimed:true (comportamento original)", async () => {
    resetMocks()
    setIdentityOwner({
      id: "profile-dono",
      displayName: "PIMENTAS BETA",
      normalizedName: "pimentas beta",
      normalizedPhone: "5512988821371",
    })

    const result = await resolveWith({ displayName: "PIMENTAS BETA", normalizedName: "pimentas beta" })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(true)
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({ where: { id: "profile-dono" } })
    expect(radarProfileCreateMock).not.toHaveBeenCalled()
  })

  it("dono ESTABELECIDO divergente, sem secundário compatível → cria perfil separado SEM enriquecer o dono nem tocar a claim", async () => {
    resetMocks()
    setIdentityOwner({
      id: "profile-dono",
      displayName: "Maria Silva",
      normalizedName: "maria silva",
      normalizedPhone: "5511988887777",
    })
    setColumnCandidates([
      {
        id: "profile-dono",
        displayName: "Maria Silva",
        normalizedName: "maria silva",
        normalizedPhone: "5511988887777",
      },
    ])

    const result = await resolveWith({ displayName: "João Pereira", normalizedName: "joao pereira" })

    expect(result.wasExisting).toBe(false)
    expect(result.emailIdentityClaimed).toBe(false)
    expect(result.profile.id).toBe("profile-novo")
    // O perfil da Maria nunca é tocado; a claim continua com ela.
    expect(radarProfileUpdateMock).not.toHaveBeenCalled()
    expect(radarIdentityUpsertMock).not.toHaveBeenCalled()
    expect(radarIdentityCreateMock).not.toHaveBeenCalled()
  })

  it("dono ESTABELECIDO divergente, mas existe secundário compatível pela coluna → enriquece o secundário (não cria terceiro perfil) e claim fica com o dono", async () => {
    resetMocks()
    setIdentityOwner({
      id: "profile-dono",
      displayName: "Maria Silva",
      normalizedName: "maria silva",
      normalizedPhone: "5511988887777",
    })
    setColumnCandidates([
      {
        id: "profile-dono",
        displayName: "Maria Silva",
        normalizedName: "maria silva",
        normalizedPhone: "5511988887777",
      },
      {
        id: "profile-joao-secundario",
        displayName: "João Pereira",
        normalizedName: "joao pereira",
        normalizedPhone: "5511977776666",
      },
    ])

    const result = await resolveWith({ displayName: "João Pereira", normalizedName: "joao pereira" })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(false)
    expect(radarProfileCreateMock).not.toHaveBeenCalled()
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-joao-secundario" },
    })
    // A claim NUNCA migra para o secundário.
    expect(radarIdentityUpsertMock).not.toHaveBeenCalled()
    expect(radarIdentityCreateMock).not.toHaveBeenCalled()
  })
})
