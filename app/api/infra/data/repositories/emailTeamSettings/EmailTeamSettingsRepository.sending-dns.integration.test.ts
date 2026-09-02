import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"

/**
 * `resendSendingDnsVerified` não pode sobreviver a um ciclo
 * desconectar → conectar.
 *
 * O gate de disparo (`hasSendingDnsReady`) libera a campanha quando este flag é
 * `true`, MESMO com `resendDomainStatus` diferente de `verified` — é o que
 * destrava um domínio que só tem o CNAME de tracking falhando. A contrapartida
 * é que o flag vira uma credencial: se ele atravessar a troca de domínio, o
 * domínio NOVO herda a verificação de DNS do ANTIGO e a campanha sai com o DKIM
 * ainda pendente, ou seja, sem assinatura.
 *
 * Roda contra o Postgres porque o que está sendo testado é o payload do
 * `upsert`/`update` — exatamente a parte que um fake de Prisma reproduziria
 * junto com o bug, passando sempre.
 *
 * Rodar: `bun run test:integration:email-domain:local` (Postgres em :55322).
 */
const RUN_INTEGRATION =
  process.env.EMAIL_DOMAIN_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL)

let prisma: typeof import("@/app/api/infra/data/prisma").prisma
let emailTeamSettingsRepository: typeof import("./EmailTeamSettingsRepository").emailTeamSettingsRepository
let emailTeamDomainEventRepository: typeof import("@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository").emailTeamDomainEventRepository

if (RUN_INTEGRATION) {
  ;({ prisma } = await import("@/app/api/infra/data/prisma"))
  ;({ emailTeamSettingsRepository } = await import("./EmailTeamSettingsRepository"))
  ;({ emailTeamDomainEventRepository } = await import(
    "@/app/api/infra/data/repositories/emailTeamDomainEvent/EmailTeamDomainEventRepository"
  ))
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip

describeIntegration("EmailTeamSettingsRepository — reset do DNS de envio", () => {
  const suffix = randomUUID().slice(0, 8)
  let profileId = ""
  let teamId = ""

  const createDefaults = {
    fromName: "Corretor Studio",
    fromEmail: "contato@mail.corretorstudio.com",
  }

  async function readFlag(): Promise<boolean> {
    const row = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: { resendSendingDnsVerified: true },
    })
    return Boolean(row?.resendSendingDnsVerified)
  }

  /** Simula o que `syncFromResendDomain` grava quando o DNS de envio está ok. */
  async function marcarEnvioVerificado(): Promise<void> {
    await emailTeamDomainEventRepository.updateDomainTracking(teamId, {
      status: "partially_failed",
      region: "us-east-1",
      openTracking: false,
      clickTracking: false,
      sendingDnsVerified: true,
    })
  }

  beforeAll(async () => {
    const profile = await prisma.profile.create({
      data: {
        supabaseId: randomUUID(),
        email: `sending-dns-${suffix}@example.com`,
        fullName: "Sending DNS Fixture",
        role: "manager",
      },
    })
    profileId = profile.id

    const team = await prisma.team.create({
      data: { name: `Sending DNS ${suffix}`, masterId: profileId, isDefault: false },
    })
    teamId = team.id

    await emailTeamSettingsRepository.saveConnectedDomain(teamId, {
      domainId: `dom-a-${suffix}`,
      domainName: `a-${suffix}.example.com`,
      status: "pending",
      region: "us-east-1",
      connectedAt: new Date(),
      openTracking: true,
      clickTracking: false,
      deliveryFrom: null,
      createDefaults,
    })
  })

  afterAll(async () => {
    if (!teamId) return
    await prisma.emailTeamSettings.deleteMany({ where: { teamId } })
    await prisma.team.deleteMany({ where: { id: teamId } })
    await prisma.profile.deleteMany({ where: { id: profileId } })
    await prisma.$disconnect()
  })

  it("nasce false ao conectar", async () => {
    expect(await readFlag()).toBe(false)
  })

  it("desconectar zera o flag de um domínio já verificado", async () => {
    await marcarEnvioVerificado()
    expect(await readFlag()).toBe(true)

    await emailTeamSettingsRepository.clearConnectedDomain(teamId, createDefaults)

    expect(await readFlag()).toBe(false)
  })

  it("conectar outro domínio não herda a verificação do anterior", async () => {
    await marcarEnvioVerificado()
    expect(await readFlag()).toBe(true)

    // Sem passar por `clearConnectedDomain`: trocar de domínio direto é um
    // caminho real (reconectar por cima) e precisa ser seguro sozinho.
    await emailTeamSettingsRepository.saveConnectedDomain(teamId, {
      domainId: `dom-b-${suffix}`,
      domainName: `b-${suffix}.example.com`,
      status: "pending",
      region: "us-east-1",
      connectedAt: new Date(),
      openTracking: true,
      clickTracking: false,
      deliveryFrom: null,
      createDefaults,
    })

    expect(await readFlag()).toBe(false)
  })

  it("clearDomainSettings do webhook também zera", async () => {
    await marcarEnvioVerificado()
    expect(await readFlag()).toBe(true)

    // Caminho do webhook `domain.deleted`, que não passa pelo repositório de
    // settings — espelha CLEAR_DOMAIN_DATA e precisa do mesmo reset.
    await emailTeamDomainEventRepository.clearDomainSettings(teamId)

    expect(await readFlag()).toBe(false)
  })
})
