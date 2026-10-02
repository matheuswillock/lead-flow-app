import { describe, expect, test } from "bun:test"
import { BackofficeLeadScheduleService } from "./BackofficeLeadScheduleService"
import type { IBackofficeLeadScheduleRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLeadSchedule/IBackofficeLeadScheduleRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import type { IBackofficeGoogleConnectionResolverService } from "../backofficeGoogleConnection/IBackofficeGoogleConnectionResolverService"
import type { IBackofficeLeadRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeLead/IBackofficeLeadRepository"
import type { IBackofficeGoogleCalendarService } from "../backofficeGoogleCalendar/IBackofficeGoogleCalendarService"
import type { IBackofficeLeadScheduleInviteService } from "./IBackofficeLeadScheduleInviteService"
import { Output } from "@/lib/output"

/**
 * SPEC 13 (Agenda na Criação de Lead), A-E1c — achado do Codex na revisão do
 * PR #1221 (R13-10): o gate `allowLegacyHttp: !isOnlineMeeting || ...`
 * aceitava e GRAVAVA qualquer link `http:` novo submetido para reunião por
 * telefone/WhatsApp. Numa atualização futura para "online", esse valor
 * persistido virava "legado" de verdade e passava a exceção de novo,
 * contornando a exigência de `https:` por completo.
 *
 * Correção: fora de reunião online, o link nunca é validado nem gravado —
 * `normalizedMeetingLink` é sempre `null`. Controle negativo (executado pelo
 * implementador, revertido e restaurado): reverter as DUAS peças da correção
 * juntas — a validação condicional por `isOnlineMeeting` (voltando para
 * `allowLegacyHttp: !isOnlineMeeting || ...` incondicional) e a atribuição de
 * `normalizedMeetingLink` (voltando para `meetingLinkValidation.normalized ??
 * null` sem o `isOnlineMeeting ? ... : null`) — faz os dois testes de
 * descarte abaixo falharem. Reverter só uma das duas não é suficiente: com a
 * validação já condicional, `meetingLinkValidation.normalized` fica
 * `undefined` fora de reunião online de qualquer forma.
 */

const closerFixture = {
  id: "closer-1",
  isActive: true,
  isCloser: true,
  email: "closer@example.com",
  timezone: "America/Sao_Paulo",
} as any

function buildService(options: { existingMeetingLink: string | null }) {
  let capturedCreateData: any = null
  let capturedUpdateData: any = null

  const scheduleRepo: Partial<IBackofficeLeadScheduleRepository> = {
    findLatestActiveByLeadId: async () =>
      ({
        id: "schedule-1",
        meetingLink: options.existingMeetingLink,
        googleEventId: null,
        googleCalendarId: null,
      }) as any,
    create: async (data) => {
      capturedCreateData = data
      return { id: "schedule-new", ...data } as any
    },
    update: async (_id, data) => {
      capturedUpdateData = data
      return { id: "schedule-1", ...data } as any
    },
  }

  const userRepo: Partial<IBackofficeUserRepository> = {
    findById: async () => closerFixture,
  }

  const googleResolver: Partial<IBackofficeGoogleConnectionResolverService> = {
    resolveForBackofficeUser: async () => null,
  }

  const leadRepo: Partial<IBackofficeLeadRepository> = {
    findById: async () => ({ phone: null }) as any,
  }

  const googleCalendarService: Partial<IBackofficeGoogleCalendarService> = {}

  const inviteService: Partial<IBackofficeLeadScheduleInviteService> = {
    sendInvite: async () => new Output(true, [], [], null),
    sendCloserNewLeadNotification: async () => new Output(true, [], [], null),
  }

  const service = new BackofficeLeadScheduleService(
    scheduleRepo as IBackofficeLeadScheduleRepository,
    userRepo as IBackofficeUserRepository,
    googleResolver as IBackofficeGoogleConnectionResolverService,
    leadRepo as IBackofficeLeadRepository,
    googleCalendarService as IBackofficeGoogleCalendarService,
    inviteService as IBackofficeLeadScheduleInviteService
  )

  return {
    service,
    getCreateData: () => capturedCreateData,
    getUpdateData: () => capturedUpdateData,
  }
}

describe("BackofficeLeadScheduleService.upsertSchedule — descarte do link fora de reunião online (R13-10)", () => {
  test("meetingType call com http: novo: link é descartado (gravado como null), não persistido", async () => {
    const { service, getUpdateData } = buildService({ existingMeetingLink: null })

    const output = await service.upsertSchedule({
      leadId: "lead-1",
      leadName: "Ana",
      leadEmail: "ana@example.com",
      closerBackofficeUserId: "closer-1",
      meetingDate: new Date("2026-10-01T14:00:00Z"),
      meetingTitle: "Ligação",
      meetingType: "call",
      meetingLink: "http://smuggled-insecure-link.example.com",
    })

    expect(output.isValid).toBe(true)
    const updateData = getUpdateData()
    expect(updateData.meetingLink).toBeNull()
  })

  test("meetingType whatsapp com http: novo: também descarta, não vaza para o schedule gravado", async () => {
    const { service, getUpdateData } = buildService({ existingMeetingLink: null })

    await service.upsertSchedule({
      leadId: "lead-1",
      leadName: "Ana",
      leadEmail: "ana@example.com",
      closerBackofficeUserId: "closer-1",
      meetingDate: new Date("2026-10-01T14:00:00Z"),
      meetingTitle: "WhatsApp",
      meetingType: "whatsapp",
      meetingLink: "http://outro-link-novo.example.com",
    })

    expect(getUpdateData().meetingLink).toBeNull()
  })

  test("reunião online com link https novo continua sendo aceita e gravada normalmente", async () => {
    const { service, getUpdateData } = buildService({ existingMeetingLink: null })

    const output = await service.upsertSchedule({
      leadId: "lead-1",
      leadName: "Ana",
      leadEmail: "ana@example.com",
      closerBackofficeUserId: "closer-1",
      meetingDate: new Date("2026-10-01T14:00:00Z"),
      meetingTitle: "Demonstração",
      meetingType: "online",
      meetingLink: "https://meet.google.com/abc-defg-hij",
    })

    expect(output.isValid).toBe(true)
    expect(getUpdateData().meetingLink).toBe("https://meet.google.com/abc-defg-hij")
  })

  test("reunião online com http: novo (não legado) continua recusada", async () => {
    const { service } = buildService({ existingMeetingLink: null })

    const output = await service.upsertSchedule({
      leadId: "lead-1",
      leadName: "Ana",
      leadEmail: "ana@example.com",
      closerBackofficeUserId: "closer-1",
      meetingDate: new Date("2026-10-01T14:00:00Z"),
      meetingTitle: "Demonstração",
      meetingType: "online",
      meetingLink: "http://novo-nao-legado.example.com",
    })

    expect(output.isValid).toBe(false)
  })
})
