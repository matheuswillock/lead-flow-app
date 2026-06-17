import { scheduleShareRepository } from "@/app/api/infra/data/repositories/scheduleShare/ScheduleShareRepository";
import { DEFAULT_TZ } from "@/lib/dates";
import {
  generateScheduleShareToken,
  getScheduleJoinAvailableAt,
  getScheduleShareExpiry,
  hashScheduleShareToken,
  isScheduleShareExpired,
  parseScheduleShareToken,
} from "@/lib/schedule-share";
import { getFullUrl } from "@/lib/utils/app-url";
import type {
  IScheduleShareService,
  PublicScheduleShareResult,
  ScheduleShareSummary,
} from "./IScheduleShareService";

const ONLINE_MEETING_TYPE = "online";

export class ScheduleShareService implements IScheduleShareService {
  async createPublicShare(input: {
    leadId: string;
    teamId: string;
  }): Promise<{
    publicUrl: string;
    expiresAt: string;
    summary: ScheduleShareSummary;
  }> {
    const lead = await scheduleShareRepository.findLeadForShare(input.leadId);

    if (!lead || lead.teamId !== input.teamId) {
      throw new Error("Lead não encontrado ou sem permissão no seu time.");
    }

    const schedule = await scheduleShareRepository.findScheduleByLeadId(input.leadId);

    if (!schedule) {
      throw new Error("Agendamento não encontrado.");
    }

    const resolvedMeetingType = schedule.meetingType ?? lead.meetingType ?? ONLINE_MEETING_TYPE;
    if (resolvedMeetingType !== ONLINE_MEETING_TYPE) {
      throw new Error("Compartilhamento público disponível apenas para agendamentos online.");
    }

    const resolvedMeetingDate = schedule.date ?? lead.meetingDate;
    if (!resolvedMeetingDate) {
      throw new Error("Agendamento sem data válida para compartilhamento.");
    }

    const resolvedMeetingTitle =
      schedule.meetingTitle?.trim() || lead.meetingTitle?.trim() || `Reunião com ${lead.name}`;

    const shareExpiresAt =
      schedule.publicShareExpiresAt && !isScheduleShareExpired(schedule.publicShareExpiresAt)
        ? schedule.publicShareExpiresAt
        : getScheduleShareExpiry(resolvedMeetingDate);
    const shareToken = generateScheduleShareToken(schedule.id, shareExpiresAt);
    const shareTokenHash = hashScheduleShareToken(shareToken);

    await scheduleShareRepository.updateScheduleShare(schedule.id, {
      publicShareTokenHash: shareTokenHash,
      publicShareExpiresAt: shareExpiresAt,
    });

    return {
      publicUrl: getFullUrl(`/agendamento/${shareToken}`),
      expiresAt: shareExpiresAt.toISOString(),
      summary: {
        leadId: lead.id,
        leadName: lead.name,
        meetingTitle: resolvedMeetingTitle,
        meetingDate: resolvedMeetingDate.toISOString(),
        meetingType: resolvedMeetingType,
        expiresAt: shareExpiresAt.toISOString(),
        timezone: lead.closerTimezone ?? DEFAULT_TZ,
      },
    };
  }

  async getPublicShare(token: string): Promise<PublicScheduleShareResult> {
    const parsedToken = parseScheduleShareToken(token);
    const tokenHash = hashScheduleShareToken(token);
    const schedule = await scheduleShareRepository.findPublicScheduleById(parsedToken.scheduleId);

    if (!schedule) {
      throw new Error("Link de agendamento inválido.");
    }

    if (schedule.publicShareTokenHash !== tokenHash) {
      throw new Error("Link de agendamento inválido.");
    }

    if (isScheduleShareExpired(schedule.publicShareExpiresAt) || isScheduleShareExpired(parsedToken.expiresAt)) {
      throw new Error("Link de agendamento expirado.");
    }

    const resolvedMeetingType = schedule.meetingType ?? schedule.leadMeetingType ?? ONLINE_MEETING_TYPE;
    if (resolvedMeetingType !== ONLINE_MEETING_TYPE) {
      throw new Error("Este agendamento não está disponível para acesso público.");
    }

    const resolvedMeetingDate = schedule.date;
    const resolvedMeetingLink = schedule.meetingLink?.trim() || schedule.leadMeetingLink?.trim() || null;

    const availableAt = getScheduleJoinAvailableAt(resolvedMeetingDate);
    const joinAllowed = !!resolvedMeetingLink && new Date().getTime() >= availableAt.getTime();

    return {
      leadName: schedule.leadName,
      meetingTitle:
        schedule.meetingTitle?.trim() ||
        schedule.leadMeetingTitle?.trim() ||
        `Reunião com ${schedule.leadName}`,
      meetingDate: resolvedMeetingDate.toISOString(),
      meetingType: resolvedMeetingType,
      expiresAt: schedule.publicShareExpiresAt!.toISOString(),
      availableAt: availableAt.toISOString(),
      timezone: schedule.closerTimezone ?? DEFAULT_TZ,
      joinAllowed,
      meetingLink: joinAllowed ? resolvedMeetingLink : null,
    };
  }
}

export const scheduleShareService = new ScheduleShareService();
