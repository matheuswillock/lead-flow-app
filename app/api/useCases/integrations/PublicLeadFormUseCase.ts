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

const SLOT_MINUTES = 30;
const TIMEZONE = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const getMinutesInDay = (date: Date) => {
  const parts = timeFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
};

const formatTimeSlot = (minutes: number) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();
const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);

type PublicIntegrationAccess = {
  profileId: string;
  managerId: string;
  teamId: string;
};

export class PublicLeadFormUseCase implements IPublicLeadFormUseCase {
  private async validateCloserForTeam(teamId: string, closerId: string): Promise<Output | null> {
    const closerMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: { teamId, profileId: closerId },
      },
      select: { functions: true },
    });

    if (!closerMember || !closerMember.functions.includes(UserFunction.CLOSER)) {
      return new Output(false, [], ["Closer inválido para o time informado."], null);
    }

    return null;
  }

  private async resolvePublicIntegrationAccess(
    supabaseId: string,
    teamId: string
  ): Promise<{ access?: PublicIntegrationAccess; output?: Output }> {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true, isMaster: true, managerId: true },
    });

    if (!profile) {
      return { output: new Output(false, [], ["Usuário não encontrado"], null) };
    }

    const managerId = profile.isMaster ? profile.id : profile.managerId;
    if (!managerId) {
      return { output: new Output(false, [], ["Master não identificado"], null) };
    }

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        OR: [
          { masterId: profile.id },
          {
            members: {
              some: {
                profileId: profile.id,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    if (!team) {
      return {
        output: new Output(false, [], ["Time não encontrado ou usuário não pertence ao time"], null),
      };
    }

    return {
      access: {
        profileId: profile.id,
        managerId,
        teamId: team.id,
      },
    };
  }

  private async listTeamCloserOptions(teamId: string) {
    const closerMembers = await prisma.teamMember.findMany({
      where: {
        teamId,
        functions: { has: UserFunction.CLOSER },
      },
      select: {
        profile: {
          select: {
            id: true,
            fullName: true,
            profileIconUrl: true,
          },
        },
      },
    });

    return closerMembers.map((member) => ({
      id: member.profile.id,
      name: member.profile.fullName || "Closer",
      avatarImageUrl: member.profile.profileIconUrl || "",
    }));
  }

  async createPublicLead(data: PublicLeadFormRequest, originContext?: PublicLeadFormOriginContext): Promise<Output> {
    try {
      const { supabaseId, teamId } = data;

      const accessResult = await this.resolvePublicIntegrationAccess(supabaseId, teamId);
      if (accessResult.output) {
        return accessResult.output;
      }
      const access = accessResult.access as PublicIntegrationAccess;

      if (data.closerId) {
        const closerValidationOutput = await this.validateCloserForTeam(access.teamId, data.closerId);
        if (closerValidationOutput) {
          return closerValidationOutput;
        }
      }

      const hasMeetingData = !!(data.closerId && data.meetingDate && data.meetingTitle);
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
        closerId: data.closerId,
        meetingDate: data.meetingDate,
        meetingTitle: data.meetingTitle,
        meetingNotes: data.meetingNotes,
        meetingLink: undefined,
        assignedTo: undefined,
        ticket: undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
        status: hasMeetingData ? LeadStatus.scheduled : LeadStatus.new_opportunity,
      };

      const leadOutput = await leadUseCase.createLead(
        supabaseId,
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
          const scheduleOutput = await leadScheduleService.createSchedule({
            leadId: createdLead.id,
            leadName: data.name,
            leadEmail: data.email || null,
            leadStatus: LeadStatus.scheduled,
            leadManagerId: access.managerId,
            leadAssignedTo: null,
            leadAssigneeEmail: null,
            leadCurrentCloserId: null,
            leadCode: createdLead.leadCode || null,
            closerId: data.closerId!,
            teamId: access.teamId,
            meetingDate: data.meetingDate!,
            meetingTitle: data.meetingTitle!,
            meetingNotes: data.meetingNotes,
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

  async getPublicFormBootstrap(supabaseId: string, teamId: string): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(supabaseId, teamId);
      if (accessResult.output) {
        return accessResult.output;
      }

      const access = accessResult.access as PublicIntegrationAccess;
      const [healthPlanOptions, closers] = await Promise.all([
        healthPlanService.listOptions(),
        this.listTeamCloserOptions(access.teamId),
      ]);

      const healthPlans = healthPlanOptions.map((option) => ({
        id: option.id,
        name: option.name,
      }));

      return new Output(true, [], [], { healthPlans, closers });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao carregar bootstrap do formulário público:", error);
      return new Output(false, [], ["Erro ao carregar dados iniciais do formulário"], null);
    }
  }

  async getTeamClosers(supabaseId: string, teamId: string): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(supabaseId, teamId);
      if (accessResult.output) {
        return accessResult.output;
      }

      const access = accessResult.access as PublicIntegrationAccess;
      const closers = await this.listTeamCloserOptions(access.teamId);

      return new Output(true, [], [], { closers });
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao listar closers do time:", error);
      return new Output(false, [], ["Erro ao listar closers do time"], null);
    }
  }

  async getCloserAvailability(
    supabaseId: string,
    teamId: string,
    closerId: string,
    date: string
  ): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(supabaseId, teamId);
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
          googleCalendarConnected: true,
          googleRefreshToken: true,
          googleAccessToken: true,
          googleTokenExpiresAt: true,
          supabaseId: true,
        },
      });

      if (!closerProfile) {
        return new Output(false, [], ["Closer não encontrado."], null);
      }

      const dayStart = new Date(`${date}T00:00:00-03:00`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const timeMin = `${date}T00:00:00-03:00`;
      const timeMax = `${date}T23:59:59-03:00`;

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
      const todayKey = dateFormatter.format(now);
      const isToday = date === todayKey;
      const nowMinutes = getMinutesInDay(now);

      const slots = Array.from({ length: 24 * (60 / SLOT_MINUTES) }, (_, index) => index * SLOT_MINUTES);

      const canUseGoogleCalendar =
        !!closerProfile.googleCalendarConnected && !!closerProfile.googleRefreshToken;
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
            const busyStart = getMinutesInDay(startClamp);
            const busyEnd = getMinutesInDay(endClamp);

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
}

export const publicLeadFormUseCase = new PublicLeadFormUseCase();
