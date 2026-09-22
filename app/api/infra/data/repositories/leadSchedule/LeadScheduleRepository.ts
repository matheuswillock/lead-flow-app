import { prisma } from "../../prisma";
import type {
  DayAgendaScheduleRow,
  ILeadScheduleRepository,
  CreateLeadScheduleDTO,
  UpdateLeadScheduleDTO,
  UpsertTransferPreScheduleDTO
} from "./ILeadScheduleRepository";
import { LeadsSchedule, Prisma } from "@prisma/client";
import {
  isTeamScopeVisibilityEmpty,
  type TeamScopeVisibility,
} from "@/lib/teams/teamScopeVisibility";
import { buildLeadScheduleTeamScopeWhere } from "./leadScheduleTeamScopeWhere";

export class LeadScheduleRepository implements ILeadScheduleRepository {
  async upsertTransferPreSchedule(data: UpsertTransferPreScheduleDTO): Promise<void> {
    const shared = {
      date: data.date,
      meetingTitle: data.meetingTitle,
      notes: data.notes,
      meetingLink: null,
      meetingType: data.meetingType,
      publicShareTokenHash: null,
      publicShareExpiresAt: null,
    };

    await prisma.leadsSchedule.upsert({
      where: { leadId: data.leadId },
      create: { leadId: data.leadId, extraGuests: [], ...shared },
      update: shared,
    });
  }


  /**
   * Cria um registro de agendamento
   */
  async create(data: CreateLeadScheduleDTO): Promise<LeadsSchedule> {
    return await prisma.leadsSchedule.create({
      data: {
        id: data.id,
        leadId: data.leadId,
        date: data.date,
        meetingTitle: data.meetingTitle,
        notes: data.notes,
        meetingLink: data.meetingLink,
        extraGuests: data.extraGuests ?? [],
        googleEventId: data.googleEventId ?? undefined,
        googleCalendarId: data.googleCalendarId ?? undefined,
        inviteDispatchStatus: data.inviteDispatchStatus ?? undefined,
        inviteDispatchFallbackUsed: data.inviteDispatchFallbackUsed ?? undefined,
        inviteDispatchLastAttemptAt: data.inviteDispatchLastAttemptAt ?? undefined,
        inviteDispatchLastError: data.inviteDispatchLastError ?? undefined,
        publicShareTokenHash: data.publicShareTokenHash ?? undefined,
        publicShareExpiresAt: data.publicShareExpiresAt ?? undefined,
        inviteDispatchLastPayload:
          data.inviteDispatchLastPayload === null
            ? Prisma.JsonNull
            : (data.inviteDispatchLastPayload ?? undefined),
      },
    });
  }

  /**
   * Busca registros de agendamentos por leadId
   */
  async findByLeadId(leadId: string): Promise<LeadsSchedule[]> {
    return await prisma.leadsSchedule.findMany({
      where: {
        leadId,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Busca o último registro de agendamento de um lead
   */
  async findLatestByLeadId(leadId: string): Promise<LeadsSchedule | null> {
    return await prisma.leadsSchedule.findFirst({
      where: {
        leadId,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  /**
   * Busca o registro único de agendamento de um lead
   */
  async findUniqueByLeadId(leadId: string): Promise<LeadsSchedule | null> {
    return await prisma.leadsSchedule.findUnique({
      where: { leadId },
    });
  }

  /**
   * Atualiza um agendamento existente
   */
  async update(id: string, data: UpdateLeadScheduleDTO): Promise<LeadsSchedule> {
    const parsedData = {
      ...data,
      inviteDispatchLastPayload:
        data.inviteDispatchLastPayload === null
          ? Prisma.JsonNull
          : (data.inviteDispatchLastPayload ?? undefined),
    };

    return await prisma.leadsSchedule.update({
      where: { id },
      data: parsedData,
    });
  }

  /**
   * Atualiza ou cria um agendamento usando leadId como chave única
   */
  async upsertByLeadId(leadId: string, data: CreateLeadScheduleDTO): Promise<LeadsSchedule> {
    const parsedData = {
      date: data.date,
      meetingTitle: data.meetingTitle,
      notes: data.notes,
      meetingLink: data.meetingLink,
      extraGuests: data.extraGuests ?? [],
      googleEventId: data.googleEventId ?? undefined,
      googleCalendarId: data.googleCalendarId ?? undefined,
      inviteDispatchStatus: data.inviteDispatchStatus ?? undefined,
      inviteDispatchFallbackUsed: data.inviteDispatchFallbackUsed ?? undefined,
      inviteDispatchLastAttemptAt: data.inviteDispatchLastAttemptAt ?? undefined,
      inviteDispatchLastError: data.inviteDispatchLastError ?? undefined,
      publicShareTokenHash: data.publicShareTokenHash ?? undefined,
      publicShareExpiresAt: data.publicShareExpiresAt ?? undefined,
      inviteDispatchLastPayload:
        data.inviteDispatchLastPayload === null
          ? Prisma.JsonNull
          : (data.inviteDispatchLastPayload ?? undefined),
    };

    return await prisma.leadsSchedule.upsert({
      where: { leadId },
      create: {
        id: data.id,
        leadId,
        ...parsedData,
      },
      update: parsedData,
    });
  }

  /**
   * SPEC 13 (Agenda na Criação de Lead), A-E2 — mesma lógica de
   * `upsertByLeadId`, mas usando o `tx` recebido em vez do `prisma` global,
   * e cobrindo também `meetingType`/`reminder30MinSentAt` (que
   * `LeadScheduleService.createSchedule` grava desde sempre, mas que
   * `CreateLeadScheduleDTO`/`upsertByLeadId` não cobriam). Extraído para
   * `IMeetingRepository.upsertMeetingWithLeadTransition` poder gravar a
   * reunião dentro da mesma transação que atualiza o lead.
   */
  async upsertByLeadIdWithTx(
    tx: Prisma.TransactionClient,
    leadId: string,
    data: CreateLeadScheduleDTO
  ): Promise<LeadsSchedule> {
    const parsedData = {
      date: data.date,
      meetingTitle: data.meetingTitle,
      notes: data.notes,
      // `meetingLink` chega como `null` explícito (reunião por
      // telefone/WhatsApp) tanto quanto uma string — `?? undefined` apagaria
      // essa distinção e deixaria de zerar o link ao mudar o tipo da reunião.
      meetingLink: data.meetingLink,
      meetingType: data.meetingType ?? undefined,
      extraGuests: data.extraGuests ?? [],
      googleEventId: data.googleEventId ?? undefined,
      googleCalendarId: data.googleCalendarId ?? undefined,
      inviteDispatchStatus: data.inviteDispatchStatus ?? undefined,
      inviteDispatchFallbackUsed: data.inviteDispatchFallbackUsed ?? undefined,
      inviteDispatchLastAttemptAt: data.inviteDispatchLastAttemptAt ?? undefined,
      inviteDispatchLastError: data.inviteDispatchLastError ?? undefined,
      publicShareTokenHash: data.publicShareTokenHash ?? undefined,
      publicShareExpiresAt: data.publicShareExpiresAt ?? undefined,
      // `??` NÃO serve aqui: precisa distinguir "não informado" (undefined,
      // não mexe no valor gravado) de "limpar o lembrete" (null explícito).
      // `createSchedule` sempre resolve um dos dois antes de chamar este
      // método — nunca deixa o campo indefinido de fato.
      reminder30MinSentAt: data.reminder30MinSentAt,
      inviteDispatchLastPayload:
        data.inviteDispatchLastPayload === null
          ? Prisma.JsonNull
          : (data.inviteDispatchLastPayload ?? undefined),
    };

    return await tx.leadsSchedule.upsert({
      where: { leadId },
      create: {
        id: data.id,
        leadId,
        ...parsedData,
      },
      update: parsedData,
    });
  }

  /**
   * Deleta um agendamento
   */
  async delete(id: string): Promise<void> {
    await prisma.leadsSchedule.delete({
      where: { id },
    });
  }

  async findDayAgendaByTeamScope(input: {
    visibility: TeamScopeVisibility;
    dayStart: Date;
    dayEnd: Date;
  }): Promise<DayAgendaScheduleRow[]> {
    if (isTeamScopeVisibilityEmpty(input.visibility)) {
      return [];
    }

    return await prisma.leadsSchedule.findMany({
      where: {
        AND: [
          buildLeadScheduleTeamScopeWhere(input.visibility),
          { date: { gte: input.dayStart, lte: input.dayEnd } },
        ],
      },
      select: {
        id: true,
        leadId: true,
        date: true,
        meetingTitle: true,
        notes: true,
        meetingLink: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            name: true,
            email: true,
            phone: true,
            meetingHeald: true,
            meetingPresenceConfirmed: true,
            assignedTo: true,
            assignee: { select: { id: true, fullName: true, email: true } },
            manager: { select: { id: true, fullName: true, email: true } },
            closer: { select: { id: true, fullName: true, email: true } },
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: "asc" },
    });
  }
}

// Instância única para uso em toda aplicação
export const leadScheduleRepository = new LeadScheduleRepository();
