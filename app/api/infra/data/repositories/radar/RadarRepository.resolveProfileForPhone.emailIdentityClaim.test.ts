import { describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

/**
 * Bug 2026-09-03 (caso PIMENTAS/KKJ): `resolveProfileForPhone` resolvia
 * telefone+e-mail e preenchia a COLUNA `normalizedPrimaryEmail` do perfil,
 * mas NUNCA reivindicava a `RadarIdentity` de e-mail correspondente (só a de
 * telefone) — `RadarBaseImportUseCase` e `syncFromPortfolio` confiavam
 * inteiramente nisso e não faziam a claim por fora (diferente de
 * `syncFromCrm`/`processEmailContactForRadar`, que já chamavam
 * `upsertIdentity` manualmente depois). Perfis assim ficavam com e-mail
 * "órfão": um contato de e-mail chegando depois (`resolveProfileForEmail`)
 * nunca encontrava o dono por `RadarIdentity` e criava um segundo perfil.
 *
 * Fix: `resolveProfileForPhone` passa a reivindicar a `RadarIdentity` de
 * e-mail transacionalmente, do mesmo jeito que já reivindica a de telefone —
 * único ponto de verdade, sem depender de cada chamador lembrar de replicar.
 */

type IdentityUpsertArgs = {
  where: { teamId_type_normalizedValue: { type: string; normalizedValue: string } }
  create: { profileId: string; type: string }
  update: { profileId: string }
}

type IdentityFindUniqueArgs = { where: { teamId_type_normalizedValue: { type: string } } }

const executeRawMock = mock(async () => 0)
const radarIdentityFindUniqueMock = mock(
  async (_args: IdentityFindUniqueArgs) => null as { profileId: string } | null
)
const radarIdentityUpsertMock = mock(async (args: IdentityUpsertArgs) => args)
// Aceita `args` para os testes das guardas discriminarem QUAL perfil está
// sendo lido (dono do e-mail vs. perfil do telefone vs. chave natural) — o
// retorno é frouxo de propósito, cada leitura seleciona um subconjunto.
const radarProfileFindUniqueMock = mock(
  async (_args: { where: Record<string, unknown> }) => null as Record<string, unknown> | null
)
const radarProfileUpdateMock = mock(async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
  id: args.where.id,
  ...args.data,
}))
const radarProfileUpsertMock = mock(async (args: { create: Record<string, unknown> }) => ({
  id: "profile-novo",
  ...args.create,
}))
const radarEventCreateMock = mock(async () => ({}))

const tx = {
  $executeRaw: executeRawMock,
  radarIdentity: { findUnique: radarIdentityFindUniqueMock, upsert: radarIdentityUpsertMock },
  radarProfile: {
    findUnique: radarProfileFindUniqueMock,
    update: radarProfileUpdateMock,
    upsert: radarProfileUpsertMock,
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

function emailUpsertCalls() {
  return radarIdentityUpsertMock.mock.calls
    .map((call) => call[0] as IdentityUpsertArgs)
    .filter((args) => args.where.teamId_type_normalizedValue.type === "email")
}

function resetMocks() {
  executeRawMock.mockClear()
  radarIdentityFindUniqueMock.mockClear()
  radarIdentityFindUniqueMock.mockResolvedValue(null)
  radarIdentityUpsertMock.mockClear()
  radarProfileFindUniqueMock.mockClear()
  radarProfileFindUniqueMock.mockResolvedValue(null)
  radarProfileUpdateMock.mockClear()
  radarProfileUpsertMock.mockClear()
  radarEventCreateMock.mockClear()
}

describe("resolveProfileForPhone — reivindica a RadarIdentity de e-mail (fecha a lacuna do bug PIMENTAS)", () => {
  it("cria perfil novo (telefone nunca visto) com e-mail → reivindica a RadarIdentity de e-mail para o perfil recém-criado", async () => {
    resetMocks()
    // Nenhum dono de telefone, nenhum dono de e-mail ainda.
    radarIdentityFindUniqueMock.mockResolvedValue(null)

    const result = await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5512988821371",
      normalizedName: "pimentas beta",
      displayName: "PIMENTAS BETA",
      displayPhone: "(12) 98882-1371",
      phoneValue: "12988821371",
      phoneSource: "base_import",
      primaryEmail: "matriz@idgt.org.br",
      normalizedPrimaryEmail: "matriz@idgt.org.br",
    })

    expect(result.wasExisting).toBe(false)
    expect(result.emailIdentityClaimed).toBe(true)
    const calls = emailUpsertCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.create.profileId).toBe("profile-novo")
    expect(calls[0]?.where.teamId_type_normalizedValue.normalizedValue).toBe("matriz@idgt.org.br")
  })

  it("cria perfil novo SEM e-mail → não tenta reivindicar identidade de e-mail nenhuma", async () => {
    resetMocks()
    radarIdentityFindUniqueMock.mockResolvedValue(null)

    await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5512988821371",
      normalizedName: "fulano",
      displayName: "Fulano",
      displayPhone: "(12) 98882-1371",
      phoneValue: "12988821371",
      phoneSource: "base_import",
    })

    expect(emailUpsertCalls()).toHaveLength(0)
  })

  it("telefone já existente e e-mail informado NUNCA reivindicado por ninguém → reivindica agora para o perfil do telefone", async () => {
    resetMocks()
    // Telefone já pertence a um perfil; e-mail (segunda chamada ao
    // findUnique, dentro do bloco `if (input.normalizedPrimaryEmail)`) não
    // pertence a ninguém.
    radarIdentityFindUniqueMock.mockImplementation(async (args: IdentityFindUniqueArgs) => {
      if (args.where.teamId_type_normalizedValue.type === "phone") {
        return { profileId: "profile-dono-telefone" }
      }
      return null
    })
    radarProfileFindUniqueMock.mockResolvedValue({
      primaryEmail: null,
      normalizedPrimaryEmail: null,
      primaryDocument: null,
      normalizedPrimaryDocument: null,
      displayName: "PIMENTAS BETA",
      normalizedName: "pimentas beta",
    })

    const result = await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5512988821371",
      normalizedName: "pimentas beta",
      displayName: "PIMENTAS BETA",
      displayPhone: "(12) 98882-1371",
      phoneValue: "12988821371",
      phoneSource: "base_import",
      primaryEmail: "matriz@idgt.org.br",
      normalizedPrimaryEmail: "matriz@idgt.org.br",
    })

    expect(result.wasExisting).toBe(true)
    const calls = emailUpsertCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.create.profileId).toBe("profile-dono-telefone")
  })

  it("telefone já existente e e-mail JÁ pertence ao MESMO perfil (merge não disparou) → não duplica a claim, mas o upsert é idempotente", async () => {
    resetMocks()
    radarIdentityFindUniqueMock.mockImplementation(async (_args: IdentityFindUniqueArgs) => ({
      profileId: "profile-dono-unico",
    }))
    radarProfileFindUniqueMock.mockResolvedValue({
      primaryEmail: "matriz@idgt.org.br",
      normalizedPrimaryEmail: "matriz@idgt.org.br",
      primaryDocument: null,
      normalizedPrimaryDocument: null,
      displayName: "PIMENTAS BETA",
      normalizedName: "pimentas beta",
    })

    await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5512988821371",
      normalizedName: "pimentas beta",
      displayName: "PIMENTAS BETA",
      displayPhone: "(12) 98882-1371",
      phoneValue: "12988821371",
      phoneSource: "base_import",
      primaryEmail: "matriz@idgt.org.br",
      normalizedPrimaryEmail: "matriz@idgt.org.br",
    })

    // Já reivindicado pelo mesmo perfil — não precisa reclamar de novo.
    expect(emailUpsertCalls()).toHaveLength(0)
  })
})

describe("resolveProfileForPhone — guarda de e-mail compartilhado (achados cursor/codex PR #1155)", () => {
  const donaDoEmail = {
    displayName: "Maria Silva",
    normalizedName: "maria silva",
    normalizedPhone: "5511988887777",
  }

  it("telefone NUNCA visto + e-mail de dono ESTABELECIDO divergente → NÃO promove (não cola o telefone novo no perfil da outra pessoa) e NÃO rouba a claim", async () => {
    resetMocks()
    radarIdentityFindUniqueMock.mockImplementation(async (args: IdentityFindUniqueArgs) => {
      if (args.where.teamId_type_normalizedValue.type === "email") {
        return { profileId: "profile-dono-email" }
      }
      return null
    })
    radarProfileFindUniqueMock.mockImplementation(async (args) => {
      if ((args.where as { id?: string }).id === "profile-dono-email") return donaDoEmail
      return null
    })

    const result = await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5511977776666",
      normalizedName: "joao pereira",
      displayName: "João Pereira",
      displayPhone: "(11) 97777-6666",
      phoneValue: "11977776666",
      phoneSource: "base_import",
      primaryEmail: "contato@empresa.com.br",
      normalizedPrimaryEmail: "contato@empresa.com.br",
    })

    // Cria o perfil do João pela chave natural — nunca via promoção do
    // perfil da Maria.
    expect(result.wasExisting).toBe(false)
    // Contrato para os chamadores (achado cursor #1155): claim ficou com a
    // dona — quem consome MUST NOT reivindicar por fora.
    expect(result.emailIdentityClaimed).toBe(false)
    expect(radarProfileUpsertMock).toHaveBeenCalledTimes(1)
    // O perfil da Maria nunca é atualizado (o telefone dela fica intacto).
    expect(radarProfileUpdateMock).not.toHaveBeenCalled()
    // A claim de e-mail continua exclusiva da Maria.
    expect(emailUpsertCalls()).toHaveLength(0)
  })

  it("telefone NUNCA visto + e-mail de dono NÃO estabelecido (perfil email-only com nome-placeholder) → promove normalmente (caso PIMENTAS intacto)", async () => {
    resetMocks()
    radarIdentityFindUniqueMock.mockImplementation(async (args: IdentityFindUniqueArgs) => {
      if (args.where.teamId_type_normalizedValue.type === "email") {
        return { profileId: "profile-email-only" }
      }
      return null
    })
    radarProfileFindUniqueMock.mockImplementation(async (args) => {
      if ((args.where as { id?: string }).id === "profile-email-only") {
        return {
          displayName: "matriz@idgt.org.br",
          normalizedName: "matriz@idgt.org.br",
          normalizedPhone: null,
        }
      }
      return null
    })

    const result = await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5512988821371",
      normalizedName: "pimentas beta",
      displayName: "PIMENTAS BETA",
      displayPhone: "(12) 98882-1371",
      phoneValue: "12988821371",
      phoneSource: "base_import",
      primaryEmail: "matriz@idgt.org.br",
      normalizedPrimaryEmail: "matriz@idgt.org.br",
    })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(true)
    // Promove o perfil email-only existente: telefone entra nele.
    expect(radarProfileUpdateMock).toHaveBeenCalledTimes(1)
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-email-only" },
      data: { normalizedPhone: "5512988821371" },
    })
    expect(radarProfileUpsertMock).not.toHaveBeenCalled()
  })

  it("telefone JÁ existente + e-mail de dono ESTABELECIDO divergente → NÃO funde os dois perfis e NÃO mexe na claim", async () => {
    resetMocks()
    radarIdentityFindUniqueMock.mockImplementation(async (args: IdentityFindUniqueArgs) => {
      if (args.where.teamId_type_normalizedValue.type === "phone") {
        return { profileId: "profile-do-joao" }
      }
      return { profileId: "profile-dono-email" }
    })
    radarProfileFindUniqueMock.mockImplementation(async (args) => {
      if ((args.where as { id?: string }).id === "profile-dono-email") return donaDoEmail
      if ((args.where as { id?: string }).id === "profile-do-joao") {
        return {
          primaryEmail: null,
          normalizedPrimaryEmail: null,
          primaryDocument: null,
          normalizedPrimaryDocument: null,
          displayName: "João Pereira",
          normalizedName: "joao pereira",
        }
      }
      return null
    })

    // Se a guarda falhar, mergeProfilesWithTx roda e explode nos mocks
    // ausentes (radarIdentity.findMany etc.) — o teste falharia por throw.
    const result = await new RadarRepository().resolveProfileForPhone({
      teamId: "team-1",
      normalizedPhone: "5511977776666",
      normalizedName: "joao pereira",
      displayName: "João Pereira",
      displayPhone: "(11) 97777-6666",
      phoneValue: "11977776666",
      phoneSource: "base_import",
      primaryEmail: "contato@empresa.com.br",
      normalizedPrimaryEmail: "contato@empresa.com.br",
    })

    expect(result.wasExisting).toBe(true)
    expect(result.emailIdentityClaimed).toBe(false)
    // Atualiza o PRÓPRIO perfil do João (coluna registra o e-mail
    // compartilhado), nunca o da Maria.
    expect(radarProfileUpdateMock).toHaveBeenCalledTimes(1)
    expect(radarProfileUpdateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "profile-do-joao" },
    })
    // Claim intacta com a Maria.
    expect(emailUpsertCalls()).toHaveLength(0)
  })
})
