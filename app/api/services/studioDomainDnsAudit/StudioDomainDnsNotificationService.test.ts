import { describe, expect, it, mock } from "bun:test"
import type { INotificationRepository } from "@/app/api/infra/data/repositories/notification/INotificationRepository"
import type { ITeamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository"
import type { StudioDomainDnsAuditResult } from "./StudioDomainDnsAuditTypes"
import { StudioDomainDnsNotificationService } from "./StudioDomainDnsNotificationService"

// Testes nunca devem chamar a API do Resend: sem chave, o serviço mantém a
// notificação in-app e apenas ignora o e-mail.
mock.module("@/lib/email", () => ({
  resend: null,
  assertResend: () => {
    throw new Error("Missing RESEND_API_KEY env var")
  },
}))

const checkedAt = new Date("2026-10-19T12:00:00.000Z")

function result(status: StudioDomainDnsAuditResult["status"]): StudioDomainDnsAuditResult {
  return {
    hostname: "forms.example.com",
    status,
    misconfigured: status === "pending",
    recommendedCNAME: status === "pending" ? "target.vercel-dns.com" : null,
    reasonCode: status === "pending" ? "dns_misconfigured" : status === "verified" ? "verified" : "domain_not_found",
    reason: "motivo",
    fingerprint: `fingerprint-${status}`,
  }
}

function makeMembers(recipients: Array<{ profileId: string; supabaseId: string }>): ITeamMembersRepository {
  return {
    findNotificationRecipients: mock(async () => recipients.map((recipient) => ({
      profileId: recipient.profileId,
      profile: { email: `${recipient.profileId}@example.com`, fullName: null, supabaseId: recipient.supabaseId },
    }))),
  } as unknown as ITeamMembersRepository
}

function makeNotifications(): INotificationRepository {
  return { createSystemNotification: mock(async () => undefined) }
}

describe("StudioDomainDnsNotificationService", () => {
  it("notifica manager e master sem duplicar o mesmo perfil", async () => {
    const notifications = makeNotifications()
    const service = new StudioDomainDnsNotificationService(
      makeMembers([{ profileId: "manager", supabaseId: "manager-sb" }, { profileId: "manager", supabaseId: "manager-sb" }, { profileId: "master", supabaseId: "master-sb" }]),
      notifications,
    )

    await service.notify({ domainId: "domain-1", teamId: "team-1", result: result("pending"), lastCheckedAt: checkedAt })

    expect(notifications.createSystemNotification).toHaveBeenCalledTimes(2)
    expect(notifications.createSystemNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "STUDIO_DOMAIN_DNS_ACTION_REQUIRED",
      message: expect.stringContaining("Ação necessária"),
      metadata: expect.objectContaining({
        hostname: "forms.example.com",
        recommendedCNAME: "target.vercel-dns.com",
        reasonCode: "dns_misconfigured",
        lastCheckedAt: checkedAt.toISOString(),
        href: "/manager-sb/email/configuracoes",
      }),
    }))
  })

  it("usa tipo e mensagem de recuperação quando o DNS volta a funcionar", async () => {
    const notifications = makeNotifications()
    const service = new StudioDomainDnsNotificationService(makeMembers([{ profileId: "master", supabaseId: "master-sb" }]), notifications)

    await service.notify({ domainId: "domain-1", teamId: "team-1", result: result("verified"), lastCheckedAt: checkedAt })

    expect(notifications.createSystemNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "STUDIO_DOMAIN_DNS_RECOVERED",
      message: expect.stringContaining("DNS recuperado"),
    }))
  })

  it("não cria notificação para auditoria inconclusiva", async () => {
    const notifications = makeNotifications()
    const service = new StudioDomainDnsNotificationService(makeMembers([{ profileId: "master", supabaseId: "master-sb" }]), notifications)

    await service.notify({ domainId: "domain-1", teamId: "team-1", result: result("inconclusive"), lastCheckedAt: checkedAt })

    expect(notifications.createSystemNotification).not.toHaveBeenCalled()
  })
})
