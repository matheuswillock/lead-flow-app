import { describe, expect, it, mock } from "bun:test"
import { prismaModuleMock, registerPrismaModuleMock } from "@/test/support/prisma-module-mock"

/**
 * Achado codex PR #1148 (P2), par do E6b: quando o e-mail do destinatário JÁ
 * tem perfil Radar, `resolveProfileForEmail` caía no branch de identidade
 * existente e atualizava só `lastSeenAt` — o `displayName` recém-conhecido
 * (nome do destinatário da campanha) era descartado, e perfis antigos com
 * nome-placeholder (o próprio e-mail, ou "Visitante Anônimo" herdado de
 * merge) nunca recebiam o nome que a mudança promete herdar.
 *
 * Regra: nome novo só entra quando o existente NÃO é usável (vazio, o rótulo
 * de anônimo, ou um placeholder com cara de e-mail) — identidade digitada
 * real nunca é sobrescrita pela inferida.
 */

const radarIdentityFindUniqueMock = mock(
  async () => ({ profileId: "profile-existente" }) as { profileId: string } | null,
)
const radarProfileFindUniqueMock = mock(
  async () => ({ displayName: "kkj@example.com" }) as { displayName: string } | null,
)
const radarProfileUpdateMock = mock(async (args: { data: Record<string, unknown> }) => ({
  id: "profile-existente",
  ...args.data,
}))

const tx = {
  $executeRaw: mock(async () => 0),
  radarIdentity: { findUnique: radarIdentityFindUniqueMock },
  radarProfile: { findUnique: radarProfileFindUniqueMock, update: radarProfileUpdateMock },
}

registerPrismaModuleMock()
Object.assign(prismaModuleMock, {
  $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
})

const { RadarRepository } = await import(
  "@/app/api/infra/data/repositories/radar/RadarRepository"
)

function resolveWith(displayName: string | null) {
  return new RadarRepository().resolveProfileForEmail({
    teamId: "team-1",
    normalizedEmail: "kkj@example.com",
    emailValue: "kkj@example.com",
    displayName,
    normalizedName: displayName ? displayName.toLowerCase() : null,
    emailSource: "email_campaign_form",
  })
}

function lastUpdateData() {
  const call = radarProfileUpdateMock.mock.calls.at(-1) as unknown as [
    { data: Record<string, unknown> },
  ]
  return call[0].data
}

describe("resolveProfileForEmail — nome do destinatário em perfil existente (E6b)", () => {
  it("perfil existente com nome-placeholder (o próprio e-mail) recebe o nome novo", async () => {
    radarProfileFindUniqueMock.mockResolvedValue({ displayName: "kkj@example.com" })
    radarProfileUpdateMock.mockClear()

    await resolveWith("Leonardo Reinvent")

    const data = lastUpdateData()
    expect(data.displayName).toBe("Leonardo Reinvent")
    expect(data.normalizedName).toBe("leonardo reinvent")
  })

  it("perfil existente rotulado 'Visitante Anônimo' recebe o nome novo", async () => {
    radarProfileFindUniqueMock.mockResolvedValue({ displayName: "Visitante Anônimo" })
    radarProfileUpdateMock.mockClear()

    await resolveWith("Leonardo Reinvent")

    expect(lastUpdateData().displayName).toBe("Leonardo Reinvent")
  })

  it("perfil existente com nome REAL não é sobrescrito pelo nome inferido", async () => {
    radarProfileFindUniqueMock.mockResolvedValue({ displayName: "Maria Silva" })
    radarProfileUpdateMock.mockClear()

    await resolveWith("Leonardo Reinvent")

    const data = lastUpdateData()
    expect(data.displayName).toBeUndefined()
    expect(data.normalizedName).toBeUndefined()
  })

  it("sem nome novo (displayName null) → comportamento atual intacto, só lastSeenAt", async () => {
    radarProfileUpdateMock.mockClear()

    await resolveWith(null)

    expect(Object.keys(lastUpdateData())).toEqual(["lastSeenAt"])
  })
})
