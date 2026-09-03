import { describe, expect, it, mock } from "bun:test"
import { RadarService } from "./RadarService"
import type { RadarRepository } from "@/app/api/infra/data/repositories/radar/RadarRepository"

/**
 * Bug 2026-09-03 (caso PIMENTAS/KKJ): `processEmailContactForRadar` sempre
 * chamava `upsertIdentity(type: "email", profileId: <perfil resolvido>)`
 * depois de `resolveProfileForEmail` — inofensivo enquanto o resolver sempre
 * reivindicava a identidade para o MESMO perfil que devolvia. Com a guarda de
 * e-mail compartilhado (`lib/radar/email-profile-match.ts`), o resolver pode
 * devolver `emailIdentityClaimed: false` (perfil separado, e-mail continua
 * exclusivo do dono original) — se o caller ainda chamasse `upsertIdentity`
 * incondicionalmente, `upsert.update.profileId` REATRIBUIRIA a identidade
 * para o perfil novo, roubando a claim do dono original sem passar por
 * merge. Este teste trava que o caller respeita a flag.
 */

const profileId = "profile-1"
const teamId = "team-1"
const contactId = "contact-1"

type UpsertIdentityArgs = { profileId: string; teamId: string; type: string; [key: string]: unknown }

function buildRepo(overrides: Record<string, unknown> = {}): RadarRepository {
  const profile = { id: profileId, teamId, gender: null, genderSource: null }

  return {
    findLeadPhoneByEmail: mock(async () => null),
    resolveProfileForEmail: mock(async () => ({ profile, wasExisting: false, emailIdentityClaimed: true })),
    resolveProfileForPhone: mock(async () => ({ profile, wasExisting: false })),
    upsertIdentity: mock(async (_args: UpsertIdentityArgs) => ({})),
    upsertSourceLink: mock(async () => ({})),
    upsertConsent: mock(async () => ({})),
    updateProfileGender: mock(async () => ({ count: 1 })),
    findEmailContactById: mock(async () => ({
      id: contactId,
      email: "joao.pereira@example.com",
      name: "João Pereira",
      isUnsubscribed: false,
      isBounced: false,
      isComplained: false,
      updatedAt: new Date("2026-09-01T12:00:00.000Z"),
      customFields: {},
      list: { teamId },
    })),
    findEmailContactLists: mock(async () => []),
    findEmailContacts: mock(async () => []),
    findEmailLogsForRadarSync: mock(async () => []),
    findBouncedEmails: mock(async () => new Set<string>()),
    ...overrides,
  } as unknown as RadarRepository
}

describe("RadarService.processEmailContactForRadar — respeita emailIdentityClaimed (guarda de e-mail compartilhado)", () => {
  it("emailIdentityClaimed=false (e-mail compartilhado, perfil separado) → NÃO chama upsertIdentity para o e-mail", async () => {
    const upsertIdentity = mock(async (_args: UpsertIdentityArgs) => ({}))
    const repo = buildRepo({
      upsertIdentity,
      resolveProfileForEmail: mock(async () => ({
        profile: { id: "profile-separado", teamId, gender: null, genderSource: null },
        wasExisting: false,
        emailIdentityClaimed: false,
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    const emailIdentityCalls = upsertIdentity.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === "email"
    )
    expect(emailIdentityCalls).toHaveLength(0)
    // Outras identidades (email_contact_id) continuam sendo registradas —
    // só a claim exclusiva de e-mail é que não deve ser roubada.
    const contactIdentityCalls = upsertIdentity.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === "email_contact_id"
    )
    expect(contactIdentityCalls).toHaveLength(1)
  })

  it("emailIdentityClaimed=true (caso comum) → continua chamando upsertIdentity para o e-mail normalmente", async () => {
    const upsertIdentity = mock(async (_args: UpsertIdentityArgs) => ({}))
    const repo = buildRepo({
      upsertIdentity,
      resolveProfileForEmail: mock(async () => ({
        profile: { id: profileId, teamId, gender: null, genderSource: null },
        wasExisting: true,
        emailIdentityClaimed: true,
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    const emailIdentityCalls = upsertIdentity.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === "email"
    )
    expect(emailIdentityCalls).toHaveLength(1)
  })

  it("resolveProfileForPhone (sem o campo emailIdentityClaimed) → comportamento intacto, continua chamando upsertIdentity para o e-mail", async () => {
    const upsertIdentity = mock(async (_args: UpsertIdentityArgs) => ({}))
    const repo = buildRepo({
      upsertIdentity,
      findLeadPhoneByEmail: mock(async () => ({ phone: "5511988887777" })),
      resolveProfileForPhone: mock(async () => ({
        profile: { id: profileId, teamId, gender: null, genderSource: null },
        wasExisting: false,
      })),
    })

    const service = new RadarService(repo)
    await service.syncFromEmail(
      { teamId, ctx: { profileId: "p", teamMember: { role: "manager", functions: [] } } },
      { emailContactId: contactId }
    )

    const emailIdentityCalls = upsertIdentity.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === "email"
    )
    expect(emailIdentityCalls).toHaveLength(1)
  })
})
