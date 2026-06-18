import { Output } from "@/lib/output";
import { LeadStatus, UserFunction } from "@prisma/client";
import { prisma } from "../../infra/data/prisma";
import { LeadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { RegisterNewUserProfile } from "../profiles/ProfileUseCase";
import { LeadUseCase } from "../leads/LeadUseCase";
import { leadScheduleService } from "../../services/leadSchedule/LeadScheduleService";
import { getCalendarBusyIntervals } from "../../services/googleCalendar/GoogleCalendarService";
import { healthPlanService } from "../../services/healthPlans/HealthPlanService";
import type { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import type { PublicLeadFormRequest } from "../../v1/integrations/lead-form/DTO/requestPublicLeadForm";
import type { IPublicLeadFormUseCase, PublicLeadFormOriginContext } from "./IPublicLeadFormUseCase";
import { DEFAULT_TZ, formatLocalDateValue, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates";
import { isGoogleConnectionActive } from "@/lib/google/connection";

const SLOT_MINUTES = 30;

const formatTimeSlot = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

type PublicIntegrationAccess = {
  supabaseId: string;
  profileId: string;
  managerId: string;
  teamId: string;
  teamName: string;
  timezone: string;
};

type TeamMemberSnapshot = {
  profileId: string;
  functions: UserFunction[];
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    profileIconUrl: string | null;
  };
};

export class PublicLeadFormUseCase implements IPublicLeadFormUseCase {
  private async validateMemberFunctionForTeam(
    teamId: string,
    profileId: string,
    requiredFunction: UserFunction,
    invalidMessage: string
  ): Promise<Output | null> {
    const member = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: { teamId, profileId },
      },
      select: { functions: true },
    });

    if (!member || !member.functions.includes(requiredFunction)) {
      return new Output(false, [], [invalidMessage], null);
    }

    return null;
  }

  private async validateCloserForTeam(teamId: string, closerId: string): Promise<Output | null> {
    return this.validateMemberFunctionForTeam(
      teamId,
      closerId,
      UserFunction.CLOSER,
      "Closer inválido para o time informado."
    );
  }

  private async validateSdrForTeam(teamId: string, sdrId: string): Promise<Output | null> {
    return this.validateMemberFunctionForTeam(
      teamId,
      sdrId,
      UserFunction.SDR,
      "SDR inválido para o time informado."
    );
  }

  private async resolvePublicIntegrationAccess(
    teamId: string,
    legacySupabaseId?: string
  ): Promise<{ access?: PublicIntegrationAccess; output?: Output }> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        masterId: true,
        master: {
          select: {
            id: true,
            supabaseId: true,
            timezone: true,
          },
        },
      },
    });

    if (!team) {
      return {
        output: new Output(false, [], ["Time não encontrado"], null),
      };
    }

    let actorProfileId = team.master.id;
    let actorSupabaseId = team.master.supabaseId;

    if (legacySupabaseId) {
      const legacyProfile = await prisma.profile.findUnique({
        where: { supabaseId: legacySupabaseId },
        select: { id: true },
      });

      if (!legacyProfile) {
        return { output: new Output(false, [], ["Usuário não encontrado"], null) };
      }

      const hasAccess =
        legacyProfile.id === team.masterId ||
        (await prisma.teamMember.findUnique({
          where: {
            teamId_profileId: {
              teamId: team.id,
              profileId: legacyProfile.id,
            },
          },
          select: { id: true },
        })) !== null;

      if (!hasAccess) {
        return {
          output: new Output(false, [], ["Time não encontrado ou usuário não pertence ao time"], null),
        };
      }

      actorProfileId = legacyProfile.id;
      actorSupabaseId = legacySupabaseId;
    }

    if (!actorSupabaseId) {
      return { output: new Output(false, [], ["Master não identificado"], null) };
    }

    return {
        access: {
          supabaseId: actorSupabaseId,
          profileId: actorProfileId,
          managerId: team.masterId,
          teamId: team.id,
          teamName: team.name,
          timezone: resolveTimezone(team.master.timezone),
        },
      };
  }

  private async listTeamMembersSnapshot(teamId: string): Promise<TeamMemberSnapshot[]> {
    return prisma.teamMember.findMany({
      where: {
        teamId,
      },
      select: {
        profileId: true,
        functions: true,
        profile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
      },
    });
  }

  private mapMembersToAssignableOptions(members: TeamMemberSnapshot[]) {
    return members
      .map((member) => ({
        id: member.profile.id,
        name: member.profile.fullName || member.profile.email || "Membro do time",
        avatarImageUrl: member.profile.profileIconUrl || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }

  private mapMembersToGuestCandidates(members: TeamMemberSnapshot[]) {
    return members
      .filter((member) => !!member.profile.email)
      .map((member) => ({
        id: member.profile.id,
        name: member.profile.fullName || member.profile.email || "Membro do time",
        email: member.profile.email as string,
        avatarImageUrl: member.profile.profileIconUrl || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }

  async createPublicLead(data: PublicLeadFormRequest, originContext?: PublicLeadFormOriginContext): Promise<Output> {
    try {
      const { teamId, supabaseId } = data;

      const accessResult = await this.resolvePublicIntegrationAccess(teamId, supabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }
      const access = accessResult.access as PublicIntegrationAccess;

      const sdrValidationOutput = await this.validateSdrForTeam(access.teamId, data.assignedTo);
      if (sdrValidationOutput) {
        return sdrValidationOutput;
      }

      if (data.closerId) {
        const closerValidationOutput = await this.validateCloserForTeam(access.teamId, data.closerId);
        if (closerValidationOutput) {
          return closerValidationOutput;
        }
      }

      const hasMeetingData = !data.isTransfer && !!(data.closerId && data.meetingDate && data.meetingTitle);
      const createLeadData: CreateLeadRequest = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        cnpj: data.cnpj,
        age: data.age,
        currentHealthPlan: data.currentHealthPlan,
        currentValue: data.currentValue,
        referenceHospital: data.referenceHospital,
        currentTreatment: data.currentTreatment,
        notes: data.notes,
        assignedTo: data.assignedTo,
        closerId: data.closerId,
        meetingDate: data.meetingDate,
        meetingTitle: data.meetingTitle,
        meetingNotes: data.meetingNotes,
        meetingLink: undefined,
        ticket: undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
        isTransfer: data.isTransfer === true,
        status: hasMeetingData ? LeadStatus.scheduled : LeadStatus.new_opportunity,
      };

      const leadOutput = await leadUseCase.createLead(
        access.supabaseId,
        createLeadData,
        access.teamId,
        originContext
          ? {
              body: "Lead criado via formulário público",
              payload: {
                kind: "lead_creation",
                channel: "public_lead_form",
                source: originContext.source,
                utm: {
                  source: originContext.utmSource ?? null,
                  medium: originContext.utmMedium ?? null,
                  campaign: originContext.utmCampaign ?? null,
                  content: originContext.utmContent ?? null,
                  term: originContext.utmTerm ?? null,
                },
                landingUrl: originContext.landingUrl ?? null,
                referrer: originContext.referrer ?? null,
                userAgent: originContext.userAgent ?? null,
                ip: originContext.ip ?? null,
                submittedAt: originContext.submittedAt ?? new Date().toISOString(),
              },
            }
          : undefined,
        { autoScheduleMeeting: false }
      );

      if (!leadOutput.isValid) {
        return leadOutput;
      }

      const createdLead = leadOutput.result as { id?: string; leadCode?: string | null } | null;

      if (hasMeetingData && createdLead?.id) {
        try {
          const sdrProfile = await prisma.profile.findUnique({
            where: { id: data.assignedTo },
            select: { email: true },
          });

          const scheduleOutput = await leadScheduleService.createSchedule({
            leadId: createdLead.id,
            leadName: data.name,
            leadEmail: data.email || null,
            leadStatus: LeadStatus.scheduled,
            leadManagerId: access.managerId,
            leadAssignedTo: data.assignedTo,
            leadAssigneeEmail: sdrProfile?.email || null,
            leadCurrentCloserId: null,
            leadCode: createdLead.leadCode || null,
            closerId: data.closerId!,
            teamId: access.teamId,
            meetingDate: data.meetingDate!,
            meetingTitle: data.meetingTitle!,
            meetingNotes: data.meetingNotes,
            extraGuests: data.extraGuests,
            createdByProfileId: access.profileId,
            transitionStatusToScheduled: false,
          });

          if (!scheduleOutput.isValid) {
            return new Output(
              true,
              ["Lead cadastrado com sucesso, mas houve um problema ao agendar a reunião."],
              scheduleOutput.errorMessages,
              leadOutput.result
            );
          }

          return new Output(
            true,
            ["Lead cadastrado e reunião agendada com sucesso!"],
            [],
            { ...leadOutput.result, schedule: scheduleOutput.result }
          );
        } catch (scheduleError) {
          console.error("[PublicLeadFormUseCase] Erro ao agendar reunião após criar lead:", scheduleError);
          return new Output(
            true,
            ["Lead cadastrado com sucesso, mas houve um problema ao agendar a reunião."],
            [],
            leadOutput.result
          );
        }
      }

      return new Output(true, ["Lead cadastrado com sucesso!"], [], leadOutput.result);
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao criar lead público:", error);

      if (error instanceof Error) {
        const normalizedError = error.message.toLowerCase();
        if (normalizedError.includes("unique constraint")) {
          if (normalizedError.includes("email")) {
            return new Output(false, [], ["Já existe um lead com este e-mail neste time"], null);
          }
          if (normalizedError.includes("cnpj")) {
            return new Output(false, [], ["Já existe um lead com este CNPJ neste time"], null);
          }
          return new Output(false, [], ["Já existe um lead com estes dados neste time"], null);
        }
      }

      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async getPublicFormBootstrap(teamId: string, legacySupabaseId?: string): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(teamId, legacySupabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }

      const access = accessResult.access as PublicIntegrationAccess;
      const [healthPlanOptions, teamMembers, transferRoutesCount] = await Promise.all([
        healthPlanService.listOptions(),
        this.listTeamMembersSnapshot(access.teamId),
        prisma.teamTransferRoute.count({ where: { sourceTeamId: access.teamId } }),
      ]);

      const healthPlans = healthPlanOptions.map((option) => ({
        id: option.id,
        name: option.name,
      }));
      const closers = this.mapMembersToAssignableOptions(
        teamMembers.filter((member) => member.functions.includes(UserFunction.CLOSER))
      );
      const sdrs = this.mapMembersToAssignableOptions(
        teamMembers.filter((member) => member.functions.includes(UserFunction.SDR))
      );
      const guestCandidates = this.mapMembersToGuestCandidates(teamMembers);

      return new Output(true, [], [], {
        teamName: access.teamName,
        healthPlans,
        closers,
        sdrs,
        guestCandidates,
        timezone: access.timezone,
        hasTransferTargets: transferRoutesCount > 0,
      });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao carregar bootstrap do formulário público:", error);
      return new Output(false, [], ["Erro ao carregar dados iniciais do formulário"], null);
    }
  }

  async getTeamClosers(teamId: string, legacySupabaseId?: string): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(teamId, legacySupabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }

      const access = accessResult.access as PublicIntegrationAccess;
      const teamMembers = await this.listTeamMembersSnapshot(access.teamId);
      const closers = this.mapMembersToAssignableOptions(
        teamMembers.filter((member) => member.functions.includes(UserFunction.CLOSER))
      );

      return new Output(true, [], [], { closers });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao listar closers do time:", error);
      return new Output(false, [], ["Erro ao listar closers do time"], null);
    }
  }

  async getCloserAvailability(
    teamId: string,
    closerId: string,
    date: string,
    legacySupabaseId?: string
  ): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(teamId, legacySupabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Output(false, [], ["Formato de data inválido. Use YYYY-MM-DD."], null);
      }

      const access = accessResult.access as PublicIntegrationAccess;
      const closerValidationOutput = await this.validateCloserForTeam(access.teamId, closerId);
      if (closerValidationOutput) {
        return closerValidationOutput;
      }

      const closerProfile = await prisma.profile.findUnique({
        where: { id: closerId },
        select: {
          id: true,
          email: true,
          googleConnection: {
            select: {
              accessToken: true,
              refreshToken: true,
              tokenExpiresAt: true,
              revokedAt: true,
            },
          },
          supabaseId: true,
        },
      });

      if (!closerProfile) {
        return new Output(false, [], ["Closer não encontrado."], null);
      }

      const timezone = access.timezone || DEFAULT_TZ;
      const { start: dayStart, end: dayEnd } = getDayRangeInTz(date, timezone);
      const timeMin = dayStart.toISOString();
      const timeMax = dayEnd.toISOString();

      const internalLeads = await prisma.lead.findMany({
        where: {
          teamId: access.teamId,
          closerId,
          status: "scheduled",
          meetingDate: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        select: { meetingDate: true },
      });

      const internalBusy = internalLeads
        .filter((lead) => !!lead.meetingDate)
        .map((lead) => {
          const start = lead.meetingDate as Date;
          const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
          return { start: start.toISOString(), end: end.toISOString() };
        });

      const now = new Date();
      const todayKey = formatLocalDateValue(now, timezone);
      const isToday = date === todayKey;
      const nowMinutes = getMinutesInTz(now, timezone);

      const slots = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => index * SLOT_MINUTES);

      const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile.googleConnection);
      let busyIntervals: Array<{ start: string; end: string }> = [];
      let source: "google" | "internal" = "internal";

      if (canUseGoogleCalendar) {
        try {
          busyIntervals = await getCalendarBusyIntervals({
            organizer: closerProfile as any,
            timeMin,
            timeMax,
          });
          source = "google";
        } catch (error) {
          console.warn(
            "[PublicLeadFormUseCase] Falha ao buscar disponibilidade no Google Calendar, usando fallback interno.",
            error
          );
          busyIntervals = internalBusy;
        }
      } else {
        busyIntervals = internalBusy;
      }

      const availableTimes = slots
        .filter((slotStart) => {
          if (isToday && slotStart < nowMinutes) {
            return false;
          }

          const slotEnd = slotStart + SLOT_MINUTES;
          return !busyIntervals.some((interval) => {
            const startDate = new Date(interval.start);
            const endDate = new Date(interval.end);

            if (endDate <= dayStart || startDate >= dayEnd) {
              return false;
            }

            const startClamp = startDate < dayStart ? dayStart : startDate;
            const endClamp = endDate > dayEnd ? dayEnd : endDate;
            const busyStart = getMinutesInTz(startClamp, timezone);
            const busyEnd = getMinutesInTz(endClamp, timezone);

            return slotStart < busyEnd && slotEnd > busyStart;
          });
        })
        .map(formatTimeSlot);

      return new Output(true, [], [], { availableTimes, source });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao buscar disponibilidade:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async getPreScheduleSlots(teamId: string, date: string, legacySupabaseId?: string): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(teamId, legacySupabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Output(false, [], ["Formato de data inválido. Use YYYY-MM-DD."], null);
      }

      const access = accessResult.access as PublicIntegrationAccess;

      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);

      const leads = await prisma.lead.findMany({
        where: {
          teamId: access.teamId,
          isTransfer: true,
          closerId: null,
          meetingDate: { gte: startOfDay, lt: endOfDay },
          status: {
            notIn: [
              LeadStatus.opportunityLost,
              LeadStatus.disqualified,
              LeadStatus.operator_denied,
              LeadStatus.contract_finalized,
            ],
          },
        },
        select: { meetingDate: true },
      });

      const occupiedSlots = leads
        .map((lead) => {
          if (!lead.meetingDate) return null;
          const d = lead.meetingDate;
          return d.getUTCHours() * 60 + Math.floor(d.getUTCMinutes() / 30) * 30;
        })
        .filter((slot): slot is number => slot !== null);

      return new Output(true, [], [], { occupiedSlots });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao buscar slots de pré-agendamento:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }
}

export const publicLeadFormUseCase = new PublicLeadFormUseCase();
