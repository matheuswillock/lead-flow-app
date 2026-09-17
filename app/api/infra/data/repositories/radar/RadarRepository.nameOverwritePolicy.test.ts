import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * Política de sobrescrita de nome, em duas camadas:
 *
 * 1. Achado #7 do code review de 2026-08-19 — fonte sem nome não apaga nome
 *    bom, e uma fonte reescreve a si mesma (correção de nome digitada depois
 *    não pode ser descartada em silêncio).
 * 2. Precedência por fonte — fonte mais fraca não sobrescreve mais forte. Sem
 *    isso o push name que o contato escolheu no WhatsApp derrubava o nome
 *    curado no CRM, e esse nome vai parar no destinatário de campanha
 *    (`buildEmailRecipients`, lib/radar/list-segment-recipients.ts).
 *
 * O ranking em si está travado em `lib/radar/name-source.test.ts`; aqui o que
 * se prova é que o repositório de fato consulta a política e respeita a
 * resposta — inclusive omitindo a coluna quando a resposta é "não escreva".
 */

type ExistingProfile = {
  primaryEmail: string | null
  normalizedPrimaryEmail: string | null
  primaryDocument: string | null
  normalizedPrimaryDocument: string | null
  displayName: string
  normalizedName: string
  normalizedPhone: string | null
  nameSource: string | null
}

let existingProfile: ExistingProfile
// Controla se `resolveProfileForPhone` encontra uma `RadarIdentity` de
// telefone (branch 1) e/ou de e-mail (branch D4) já existente. Default
// reproduz o comportamento anterior à cobertura de D4: telefone já
// identificado, sem e-mail.
let phoneIdentityProfileId: string | null = "profile-1"
let emailIdentityProfileId: string | null = null

const radarIdentityFindUniqueMock = mock(async (args: { where: { teamId_type_normalizedValue: { type: string } } }) => {
  const type = args.where.teamId_type_normalizedValue.type
  if (type === "phone") return phoneIdentityProfileId ? { profileId: phoneIdentityProfileId } : null
  if (type === "contract_holder") return { profileId: "profile-1" }
  if (type === "email") return emailIdentityProfileId ? { profileId: emailIdentityProfileId } : null
  return null
})
const radarIdentityUpsertMock = mock(async (args: { create: Record<string, unknown> }) => ({
  id: "identity-1",
  ...args.create,
}))
const radarProfileFindUniqueMock = mock(async (_args: unknown) => existingProfile)
const radarProfileUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "profile-1",
  ...args.data,
}))

const txMock = {
  $executeRaw: mock(async () => 0),
  radarIdentity: { findUnique: radarIdentityFindUniqueMock, upsert: radarIdentityUpsertMock },
  radarProfile: { findUnique: radarProfileFindUniqueMock, update: radarProfileUpdateMock },
}

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  },
  withPrismaRetry: async <T>(operation: () => Promise<T>) => operation(),
}))

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

function lastUpdateData(): Record<string, unknown> {
  const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [{ data: Record<string, unknown> }]
  return call[0].data
}

function phoneInput(overrides: {
  displayName: string
  normalizedName: string
  phoneSource: string
  nameSource?: string
  normalizedPrimaryEmail?: string
}) {
  return {
    teamId: "team-1",
    normalizedPhone: "5511999999999",
    displayPhone: "(11) 99999-9999",
    phoneValue: "(11) 99999-9999",
    ...overrides,
  }
}

beforeEach(() => {
  existingProfile = {
    primaryEmail: null,
    normalizedPrimaryEmail: null,
    primaryDocument: null,
    normalizedPrimaryDocument: null,
    displayName: "Nome Antigo",
    normalizedName: "nome antigo",
    normalizedPhone: null,
    nameSource: null,
  }
  phoneIdentityProfileId = "profile-1"
  emailIdentityProfileId = null
})

describe("Achado #7 — fonte sem nome nunca apaga nome bom", () => {
  it("resolveProfileForPhone não toca no nome quando a fonte atual não traz nome", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({ displayName: "", normalizedName: "", phoneSource: "whatsapp" })
    )

    // Não é "reescreve o valor antigo": a coluna fica fora do update.
    expect(lastUpdateData().displayName).toBeUndefined()
    expect(lastUpdateData().normalizedName).toBeUndefined()
  })

  it("resolveProfileForDocument não toca no nome com string vazia", async () => {
    const repo = new RadarRepository()
    await repo.resolveProfileForDocument({
      teamId: "team-1",
      identityType: "contract_holder",
      normalizedDocument: "12345678900",
      documentValue: "123.456.789-00",
      displayName: "",
      normalizedName: "",
      documentSource: "crm",
    })

    expect(lastUpdateData().displayName).toBeUndefined()
    expect(lastUpdateData().normalizedName).toBeUndefined()
  })

  it("a mesma fonte reescreve a si mesma — correção de nome no CRM não é descartada", async () => {
    existingProfile.displayName = "Joao Pedro"
    existingProfile.normalizedName = "joao pedro"
    existingProfile.nameSource = "crm"

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({ displayName: "João Pedro Almeida", normalizedName: "joao pedro almeida", phoneSource: "crm" })
    )

    expect(lastUpdateData().displayName).toBe("João Pedro Almeida")
    expect(lastUpdateData().nameSource).toBe("crm")
  })
})

describe("Precedência por fonte", () => {
  it("push name do WhatsApp NÃO sobrescreve nome curado no CRM", async () => {
    existingProfile.displayName = "João Pedro Almeida"
    existingProfile.normalizedName = "joao pedro almeida"
    existingProfile.nameSource = "crm"

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({
        displayName: "Jhow 🔥",
        normalizedName: "jhow",
        phoneSource: "whatsapp",
        nameSource: "whatsapp",
      })
    )

    expect(lastUpdateData().displayName).toBeUndefined()
    expect(lastUpdateData().nameSource).toBeUndefined()
  })

  it("nome digitado à mão no inbox do WhatsApp sobrescreve o do CRM", async () => {
    existingProfile.displayName = "João Pedro Almeida"
    existingProfile.normalizedName = "joao pedro almeida"
    existingProfile.nameSource = "crm"

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({
        displayName: "João P. Almeida (sócio)",
        normalizedName: "joao p almeida socio",
        phoneSource: "whatsapp",
        nameSource: "manual",
      })
    )

    expect(lastUpdateData().displayName).toBe("João P. Almeida (sócio)")
    expect(lastUpdateData().nameSource).toBe("manual")
  })

  it("CRM sobrescreve push name que já estava no perfil", async () => {
    existingProfile.displayName = "Jhow 🔥"
    existingProfile.normalizedName = "jhow"
    existingProfile.nameSource = "whatsapp"

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({
        displayName: "João Pedro Almeida",
        normalizedName: "joao pedro almeida",
        phoneSource: "crm",
      })
    )

    expect(lastUpdateData().displayName).toBe("João Pedro Almeida")
    expect(lastUpdateData().nameSource).toBe("crm")
  })

  it("perfil legado sem nameSource aceita qualquer origem (rank desconhecido é o piso)", async () => {
    existingProfile.nameSource = null

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({ displayName: "Maria S.", normalizedName: "maria s", phoneSource: "whatsapp", nameSource: "whatsapp" })
    )

    expect(lastUpdateData().displayName).toBe("Maria S.")
    expect(lastUpdateData().nameSource).toBe("whatsapp")
  })

  it("resolveProfileForDocument também respeita a precedência", async () => {
    existingProfile.displayName = "Ana Manual"
    existingProfile.normalizedName = "ana manual"
    existingProfile.nameSource = "manual"

    const repo = new RadarRepository()
    await repo.resolveProfileForDocument({
      teamId: "team-1",
      identityType: "contract_holder",
      normalizedDocument: "12345678900",
      documentValue: "123.456.789-00",
      displayName: "ANA DA SILVA",
      normalizedName: "ana da silva",
      documentSource: "lead_finalized",
    })

    expect(lastUpdateData().displayName).toBeUndefined()
  })
})

describe("D4 — promoção de perfil email-only para telefone (achado de review PR #1059)", () => {
  // D4 é o branch de resolveProfileForPhone que promove um perfil que só
  // tinha e-mail (sem `RadarIdentity` de telefone ainda) quando o telefone
  // chega pela primeira vez para aquele e-mail. Antes deste teste, este
  // branch gravava normalizedPhone/displayPhone mas nunca passava pelo
  // `resolveRadarName` — diferente dos outros dois pontos de escrita de nome
  // desta mesma função. Aqui simulamos: sem identidade de telefone ainda
  // (`phoneIdentityProfileId = null`), com identidade de e-mail já
  // reivindicada por um perfil (`emailIdentityProfileId`) — o que força a
  // execução do branch D4 em vez do branch 1 (telefone já identificado) ou
  // do upsert por chave natural.
  beforeEach(() => {
    phoneIdentityProfileId = null
    emailIdentityProfileId = "email-profile-1"
  })

  it("push name do WhatsApp chegando via D4 NÃO sobrescreve nome curado no CRM", async () => {
    existingProfile.displayName = "João Pedro Almeida"
    existingProfile.normalizedName = "joao pedro almeida"
    existingProfile.nameSource = "crm"
    existingProfile.normalizedPhone = null // perfil ainda era email-only

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({
        displayName: "Jhow 🔥",
        normalizedName: "jhow",
        phoneSource: "whatsapp",
        normalizedPrimaryEmail: "joao@example.com",
      })
    )

    expect(lastUpdateData().normalizedPhone).toBe("5511999999999")
    expect(lastUpdateData().displayName).toBeUndefined()
    expect(lastUpdateData().nameSource).toBeUndefined()
  })

  it("D4 aceita o nome quando o perfil email-only ainda não tem nome usável", async () => {
    existingProfile.displayName = ""
    existingProfile.normalizedName = ""
    existingProfile.nameSource = null
    existingProfile.normalizedPhone = null

    const repo = new RadarRepository()
    await repo.resolveProfileForPhone(
      phoneInput({
        displayName: "Maria S.",
        normalizedName: "maria s",
        phoneSource: "whatsapp",
        normalizedPrimaryEmail: "maria@example.com",
      })
    )

    expect(lastUpdateData().displayName).toBe("Maria S.")
    expect(lastUpdateData().nameSource).toBe("whatsapp")
  })
})
