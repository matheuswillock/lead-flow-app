import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { deriveSendingDnsVerified } from "@/lib/email/resend-domain-records"

export type EmailTeamDomainEventType =
  | "domain_added"
  | "dns_verified"
  | "domain_verified"
  | "domain_deleted"
  | "domain_failed"

export type DomainEventRecord = {
  id: string
  type: EmailTeamDomainEventType
  occurredAt: Date
  metadata: Record<string, unknown> | null
}

export type ResendDomainSnapshot = {
  id?: string
  name?: string
  status?: string
  region?: string
  /** `record` é o propósito (`DKIM`, `SPF`, `Tracking`, `TrackingCAA`, `Receiving`). */
  records?: Array<{ status?: string; record?: string }>
  open_tracking?: boolean
  click_tracking?: boolean
  openTracking?: boolean
  clickTracking?: boolean
  tracking_subdomain?: string | null
  trackingSubdomain?: string | null
}

export type ConnectedResendDomainRow = {
  teamId: string
  resendDomainId: string
  resendDomainName: string | null
  resendDomainStatus: string | null
  resendDomainRegion: string | null
  resendOpenTracking: boolean
  resendClickTracking: boolean
  resendSendingDnsVerified: boolean
}

export interface IEmailTeamDomainEventRepository {
  listEvents(teamId: string): Promise<DomainEventRecord[]>
  recordEventIfMissing(
    teamId: string,
    type: EmailTeamDomainEventType,
    occurredAt: Date,
    metadata?: Record<string, unknown>
  ): Promise<void>
  findTeamByResendDomainId(resendDomainId: string): Promise<{
    teamId: string
    resendDomainName: string | null
  } | null>
  updateDomainTracking(
    teamId: string,
    data: {
      status: string
      region: string | null
      openTracking: boolean
      clickTracking: boolean
    }
  ): Promise<void>
  clearDomainSettings(teamId: string): Promise<void>
  syncFromResendDomain(
    teamId: string,
    domain: ResendDomainSnapshot,
    occurredAt: Date
  ): Promise<{
    status: string
    region: string | null
    openTracking: boolean
    clickTracking: boolean
    trackingSubdomain: string | null
  }>
  listConnectedDomains(): Promise<ConnectedResendDomainRow[]>
}

export class EmailTeamDomainEventRepository implements IEmailTeamDomainEventRepository {
  async listEvents(teamId: string): Promise<DomainEventRecord[]> {
    const rows = await prisma.emailTeamDomainEvent.findMany({
      where: { teamId },
      select: { id: true, type: true, occurredAt: true, metadata: true },
      orderBy: { occurredAt: "asc" },
    })

    return rows.map((row) => ({
      id: row.id,
      type: row.type as EmailTeamDomainEventType,
      occurredAt: row.occurredAt,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
    }))
  }

  async recordEventIfMissing(
    teamId: string,
    type: EmailTeamDomainEventType,
    occurredAt: Date,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const existing = await prisma.emailTeamDomainEvent.findFirst({
      where: { teamId, type },
      select: { id: true },
    })
    if (existing) return

    await prisma.emailTeamDomainEvent.create({
      data: {
        teamId,
        type,
        occurredAt,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })
  }

  async findTeamByResendDomainId(resendDomainId: string) {
    return prisma.emailTeamSettings.findFirst({
      where: { resendDomainId },
      select: { teamId: true, resendDomainName: true },
    })
  }

  async updateDomainTracking(
    teamId: string,
    data: {
      status: string
      region: string | null
      openTracking: boolean
      clickTracking: boolean
      /**
       * Omitido quando a origem não traz `records` — nesse caso o valor atual é
       * preservado. Gravar `false` por ausência de dado bloquearia disparo de
       * quem está com o DNS de envio íntegro.
       */
      sendingDnsVerified?: boolean
    }
  ): Promise<void> {
    await prisma.emailTeamSettings.update({
      where: { teamId },
      data: {
        resendDomainStatus: data.status,
        resendDomainRegion: data.region,
        resendOpenTracking: data.openTracking,
        resendClickTracking: data.clickTracking,
        ...(data.sendingDnsVerified === undefined
          ? {}
          : { resendSendingDnsVerified: data.sendingDnsVerified }),
      },
    })
  }

  async clearDomainSettings(teamId: string): Promise<void> {
    await prisma.emailTeamSettings.update({
      where: { teamId },
      data: {
        resendDomainId: null,
        resendDomainName: null,
        resendDomainStatus: null,
        resendDomainRegion: null,
        resendDomainConnectedAt: null,
        resendOpenTracking: false,
        resendClickTracking: false,
        // Espelha CLEAR_DOMAIN_DATA em EmailTeamSettingsRepository: o flag não
        // pode sobreviver à desconexão, senão o próximo domínio herda a
        // verificação de DNS do anterior.
        resendSendingDnsVerified: false,
      },
    })
  }

  async syncFromResendDomain(teamId: string, domain: ResendDomainSnapshot, occurredAt: Date) {
    const status = domain.status ?? "pending"
    const region = domain.region ?? null
    const openTracking = Boolean(domain.openTracking ?? domain.open_tracking)
    const clickTracking = Boolean(domain.clickTracking ?? domain.click_tracking)
    const trackingSubdomain =
      domain.trackingSubdomain?.trim() ||
      domain.tracking_subdomain?.trim() ||
      null

    const records = domain.records ?? []

    // `undefined` quando a resposta não permite concluir (sem registros, ou
    // nenhum com rótulo de envio). Preserva o valor gravado em vez de rebaixá-lo
    // por falta de informação — ver `deriveSendingDnsVerified`.
    const sendingDnsVerified = deriveSendingDnsVerified(records)

    await this.updateDomainTracking(teamId, {
      status,
      region,
      openTracking,
      clickTracking,
      sendingDnsVerified,
    })

    const allRecordsVerified =
      records.length > 0 && records.every((record) => record.status === "verified")

    if (allRecordsVerified) {
      await this.recordEventIfMissing(teamId, "dns_verified", occurredAt, {
        domainId: domain.id,
        domainName: domain.name,
      })
    }

    if (status === "verified") {
      await this.recordEventIfMissing(teamId, "domain_verified", occurredAt, {
        domainId: domain.id,
        domainName: domain.name,
      })
    }

    if (status === "failed" || status === "temporary_failure") {
      await this.recordEventIfMissing(teamId, "domain_failed", occurredAt, {
        domainId: domain.id,
        domainName: domain.name,
        status,
      })
    }

    return { status, region, openTracking, clickTracking, trackingSubdomain }
  }

  async listConnectedDomains(): Promise<ConnectedResendDomainRow[]> {
    const rows = await prisma.emailTeamSettings.findMany({
      where: { resendDomainId: { not: null } },
      select: {
        teamId: true,
        resendDomainId: true,
        resendDomainName: true,
        resendDomainStatus: true,
        resendDomainRegion: true,
        resendOpenTracking: true,
        resendClickTracking: true,
        resendSendingDnsVerified: true,
      },
    })

    return rows.flatMap((row) => {
      if (!row.resendDomainId) return []
      return [
        {
          teamId: row.teamId,
          resendDomainId: row.resendDomainId,
          resendDomainName: row.resendDomainName,
          resendDomainStatus: row.resendDomainStatus,
          resendDomainRegion: row.resendDomainRegion,
          resendOpenTracking: row.resendOpenTracking,
          resendClickTracking: row.resendClickTracking,
          resendSendingDnsVerified: row.resendSendingDnsVerified,
        },
      ]
    })
  }
}

export const emailTeamDomainEventRepository = new EmailTeamDomainEventRepository()
