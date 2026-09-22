import { Output } from "@/lib/output";
import { ActivityType, LeadStatus, UserFunction } from "@prisma/client";
import { prisma } from "../../infra/data/prisma";
import { LeadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { leadActivityRepository } from "../../infra/data/repositories/leadActivity/LeadActivityRepository";
import { RegisterNewUserProfile } from "../profiles/ProfileUseCase";
import { LeadUseCase } from "../leads/LeadUseCase";
import { leadScheduleService } from "../../services/leadSchedule/LeadScheduleService";
import { getCalendarBusyIntervals } from "../../services/googleCalendar/GoogleCalendarService";
import { healthPlanService } from "../../services/healthPlans/HealthPlanService";
import type { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import type { PublicLeadFormRequest } from "../../v1/integrations/lead-form/DTO/requestPublicLeadForm";
import type { IPublicLeadFormUseCase, PublicLeadFormOriginContext } from "./IPublicLeadFormUseCase";
import { DEFAULT_TZ, formatLocalDateValue, getBusyMinutesRangeInDay, getDayRangeInTz, getMinutesInTz, resolveTimezone } from "@/lib/dates";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import { getPreScheduleSlotsPayload } from "../../services/preSchedule/PreScheduleSlotService";
import { leadCustomFieldService } from "../../services/leadCustomField/LeadCustomFieldService";
import { mapLeadCustomFieldDefinitionToDTO } from "../../infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";
import { validateLeadCustomFieldsPayload } from "@/lib/leadCustomFields/schema";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";

const SLOT_MINUTES = 30;

// SPEC 40 DA2 (V8): a rota pública nunca confirma se o lead já existia.
// Duplicata por telefone (`requiresDuplicateConfirmation`), e-mail ou CNPJ
// (mensagens abaixo, vindas de `LeadUseCase.createLeadInternal`) recebem a
// MESMA resposta de um lead novo — sem id, nome, telefone, e-mail, CNPJ ou
// status do lead existente. D25 (decidida pelo owner em 22/09): o
// tratamento interno registra uma atividade "Novo envio pelo formulário
// público" no lead existente (ver `recordDuplicateSubmissionActivity`) —
// nenhum lead novo é criado, e a resposta pública continua idêntica à de um
// lead novo.
// SPEC 40 R40-1: exportado — `lead-form/route.ts` usa a MESMA constante para
// forçar essa mensagem (e `result: null`) em QUALQUER resposta 201, sucesso
// ou duplicata. O `Output.result` de um lead criado com sucesso
// (`LeadUseCase.createLead`) inclui `manager`/`assignee`/`closer` com
// e-mail — nunca deixar isso sair pela rota pública, mesmo sem duplicata.
export const PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE = "Lead cadastrado com sucesso!";
// SPEC 40 R40-3: string matching é defesa em profundidade, não a fonte da
// verdade — o discriminador tipado `isDuplicateConflict`/
// `requiresDuplicateConfirmation` no `result` (ver `isDuplicateLeadOutcome`)
// é quem decide. Esta lista cobre o texto real hoje emitido por
// `LeadUseCase.createLeadInternal`, incluindo as duas variantes sem acento
// do catch de unique constraint (`:` sem "Já"/"únicos" — texto pré-existente
// naquele arquivo, fora do escopo desta SPEC corrigir a acentuação).
const PUBLIC_LEAD_FORM_DUPLICATE_MESSAGE_PREFIXES = [
  "Já existe um lead com este CNPJ neste time",
  "Já existe um lead com este e-mail neste time",
  "Já existe um lead com estes dados neste time",
  "Possível lead duplicado neste time",
  "Ja existe um lead com este e-mail",
  "Ja existe um lead com este CNPJ",
  "Ja existe um lead com estes dados unicos",
];

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
    profileIconUrl: string | null;
  };
};

export class PublicLeadFormUseCase implements IPublicLeadFormUseCase {
  private async canCreateTransferLead(teamId: string): Promise<boolean> {
    const transferRoutesCount = await prisma.teamTransferRoute.count({
      where: { sourceTeamId: teamId },
    });

    return transferRoutesCount > 0;
  }

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
        // SPEC 40 DA3/T-40.5 (V8): sem fallback para e-mail — nome de
        // exibição no bootstrap público nunca pode virar um e-mail de membro.
        name: member.profile.fullName || "Membro do time",
        avatarImageUrl: member.profile.profileIconUrl || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }

  // SPEC 40 DA3/T-40.5 (V8): removido `mapMembersToGuestCandidates` — devolvia
  // e-mail de qualquer membro do time (não só closer/SDR) no bootstrap
  // público, sem autenticação. O seletor "Adicionar membros do time" no
  // formulário foi removido junto (`SchedulingSection.tsx`); o campo de
  // convidados manual por e-mail continua funcionando. Restringir convidados
  // a membros do time (D11) é da A-E3, bloqueada por [[13]].

  /**
   * SPEC 40 DA2/T-40.3/T-40.4/R40-3 (V8): decide se o `Output` de
   * `leadUseCase.createLead` é uma rejeição por duplicata (telefone via
   * `requiresDuplicateConfirmation`, e-mail/CNPJ via `isDuplicateConflict` —
   * ambos discriminadores tipados vindos de `LeadUseCase.ts`) — caso em que
   * a resposta pública precisa ser neutralizada antes de sair daqui. O
   * casamento de mensagem é só defesa em profundidade: um discriminador
   * ausente por engano em algum retorno futuro de `LeadUseCase` não deixa a
   * checagem inteira sem rede.
   */
  private isDuplicateLeadOutcome(output: Output): boolean {
    const result = output.result as
      | { requiresDuplicateConfirmation?: boolean; isDuplicateConflict?: boolean }
      | null;
    if (result?.requiresDuplicateConfirmation === true) return true;
    if (result?.isDuplicateConflict === true) return true;
    return output.errorMessages.some((message) =>
      PUBLIC_LEAD_FORM_DUPLICATE_MESSAGE_PREFIXES.some((prefix) => message.startsWith(prefix))
    );
  }

  private buildNeutralAcceptedResponse(): Output {
    return new Output(true, [PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE], [], null);
  }

  private extractExistingLeadId(output: Output): string | null {
    const result = output.result as
      | { existingLeadId?: string | null; duplicateCandidates?: Array<{ id?: string }> }
      | null;
    return result?.existingLeadId ?? result?.duplicateCandidates?.[0]?.id ?? null;
  }

  /**
   * SPEC 40 D25 (decidida pelo owner em 22/09): quando o envio público bate
   * num lead existente, nenhum lead novo é criado e a resposta pública
   * continua neutra — mas o time precisa saber que houve um novo envio.
   * Registra uma atividade "Studio" (sem autor humano) no lead existente,
   * com os dados enviados e a origem (mesmo formato de
   * `originContext.payload` usado na criação de um lead novo por este
   * formulário, ver `createPublicLead`). Best-effort: se a gravação falhar,
   * loga e segue — nunca derruba a resposta neutra por causa disso.
   */
  private async recordDuplicateSubmissionActivity(
    existingLeadId: string,
    data: PublicLeadFormRequest,
    originContext?: PublicLeadFormOriginContext
  ): Promise<void> {
    try {
      await leadActivityRepository.create({
        leadId: existingLeadId,
        ...buildStudioActivityData({
          type: ActivityType.note,
          body: "Novo envio pelo formulário público",
          payload: {
            kind: "duplicate_submission",
            channel: "public_lead_form",
            submittedData: {
              name: data.name,
              email: data.email ?? null,
              phone: data.phone,
              cnpj: data.cnpj ?? null,
              currentHealthPlan: data.currentHealthPlan ?? null,
              notes: data.notes ?? null,
            },
            origin: originContext
              ? {
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
                }
              : null,
          },
        }),
      });
    } catch (error) {
      console.error(
        "[PublicLeadFormUseCase] Erro ao registrar atividade de envio duplicado no lead existente:",
        error
      );
    }
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

      if (data.isTransfer === true && !data.saveAsDraft) {
        const canTransfer = await this.canCreateTransferLead(access.teamId);
        if (!canTransfer) {
          return new Output(false, [], ["Transferência indisponível para este time."], null);
        }

      }

      const saveAsDraft = data.saveAsDraft === true;
      const publicCustomFieldDefinitions = await leadCustomFieldService.listActivePublicDefinitionsByTeamId(
        access.teamId
      );
      const publicCustomFieldDtos = publicCustomFieldDefinitions.map(mapLeadCustomFieldDefinitionToDTO);
      if (publicCustomFieldDtos.length > 0 || data.customFields) {
        const customFieldsValidation = validateLeadCustomFieldsPayload(
          publicCustomFieldDtos,
          data.customFields ?? {},
          !saveAsDraft
        );
        if (!customFieldsValidation.success) {
          return new Output(false, [], customFieldsValidation.errors, null);
        }
      }
      const allowedCustomFieldKeys = new Set(publicCustomFieldDtos.map((definition) => definition.key));
      const sanitizedCustomFields = data.customFields
        ? Object.fromEntries(
            Object.entries(data.customFields).filter(([key]) => allowedCustomFieldKeys.has(key))
          )
        : undefined;

      const hasMeetingData =
        !saveAsDraft && !data.isTransfer && !!(data.closerId && data.meetingDate && data.meetingTitle);
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
        closerId: data.isTransfer === true ? undefined : data.closerId,
        meetingDate: data.meetingDate,
        meetingTitle: data.meetingTitle,
        meetingNotes: data.meetingNotes,
        meetingLink: undefined,
        ticket: undefined,
        contractDueDate: undefined,
        soldPlan: undefined,
        isTransfer: data.isTransfer === true,
        saveAsDraft,
        customFields:
          sanitizedCustomFields && Object.keys(sanitizedCustomFields).length > 0
            ? sanitizedCustomFields
            : undefined,
        status: saveAsDraft
          ? null
          : hasMeetingData
            ? LeadStatus.scheduled
            : LeadStatus.new_opportunity,
        originChannel: "legacy_public_widget",
      };

      const leadOutput = await leadUseCase.createLead(
        access.supabaseId,
        createLeadData,
        access.teamId,
        originContext
          ? {
              authorAsStudio: true,
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
        // SPEC 40 DA2/T-40.3/T-40.4 (V8): duplicata (telefone, e-mail ou
        // CNPJ) recebe a MESMA resposta pública de um lead novo. NUNCA
        // repassar `leadOutput` inteiro aqui para esse caso — ele carrega
        // `duplicateCandidates` (id, nome, telefone, e-mail, status).
        if (this.isDuplicateLeadOutcome(leadOutput)) {
          // SPEC 40 D25 (decidida pelo owner em 22/09): nenhum lead novo
          // nasce, a resposta pública é neutra, mas o lead existente recebe
          // uma atividade registrando o novo envio.
          const existingLeadId = this.extractExistingLeadId(leadOutput);
          console.info(
            "[PublicLeadFormUseCase] Envio público neutralizado — duplicata bloqueada por dentro, atividade registrada no lead existente (D25)",
            { teamId: access.teamId, existingLeadId }
          );
          if (existingLeadId) {
            await this.recordDuplicateSubmissionActivity(existingLeadId, data, originContext);
          }
          return this.buildNeutralAcceptedResponse();
        }
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
            authorAsStudio: true,
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
          // SPEC 40 DA2/T-40.4 (V8): mesma neutralização quando a duplicata só
          // aparece como conflito de índice único do Postgres (corrida entre
          // o pre-check em `LeadUseCase` e o insert) — nunca devolver "Já
          // existe um lead com..." para quem preenche o formulário público.
          // D25: sem `leadOutput.result` aqui (é uma exceção crua, não um
          // `Output`), não há como resolver o lead existente pra registrar
          // atividade sem uma consulta extra — e este caminho é, na prática,
          // inatingível hoje: `LeadUseCase.createLeadInternal` já captura o
          // P2002 internamente e nunca deixa a exceção chegar até aqui (ver
          // `LeadUseCase.ts` catch em `createLeadInternal`, que já resolve e
          // registra `existingLeadId`). Mantido como rede de segurança.
          return this.buildNeutralAcceptedResponse();
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
      const [healthPlanOptions, teamMembers, transferRoutesCount, publicCustomFieldDefinitions] =
        await Promise.all([
        healthPlanService.listOptions(),
        this.listTeamMembersSnapshot(access.teamId),
        prisma.teamTransferRoute.count({ where: { sourceTeamId: access.teamId } }),
        leadCustomFieldService.listActivePublicDefinitionsByTeamId(access.teamId),
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

      return new Output(true, [], [], {
        teamName: access.teamName,
        healthPlans,
        closers,
        sdrs,
        timezone: access.timezone,
        hasTransferTargets: transferRoutesCount > 0,
        customFieldDefinitions: publicCustomFieldDefinitions.map(mapLeadCustomFieldDefinitionToDTO),
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
    legacySupabaseId?: string,
    slotMinutes = SLOT_MINUTES,
  ): Promise<Output> {
    try {
      const accessResult = await this.resolvePublicIntegrationAccess(teamId, legacySupabaseId);
      if (accessResult.output) {
        return accessResult.output;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Output(false, [], ["Formato de data inválido. Use YYYY-MM-DD."], null);
      }

      const resolvedSlotMinutes =
        Number.isFinite(slotMinutes) && slotMinutes >= 5 && slotMinutes <= 480
          ? Math.floor(slotMinutes)
          : SLOT_MINUTES;

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
          const end = new Date(start.getTime() + resolvedSlotMinutes * 60 * 1000);
          return { start: start.toISOString(), end: end.toISOString() };
        });

      const now = new Date();
      const todayKey = formatLocalDateValue(now, timezone);
      const isToday = date === todayKey;
      const nowMinutes = getMinutesInTz(now, timezone);

      const slots = Array.from(
        { length: Math.floor((24 * 60) / resolvedSlotMinutes) },
        (_, index) => index * resolvedSlotMinutes,
      );

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

          const slotEnd = slotStart + resolvedSlotMinutes;
          return !busyIntervals.some((interval) => {
            const startDate = new Date(interval.start);
            const endDate = new Date(interval.end);

            const busyRange = getBusyMinutesRangeInDay(
              { start: startDate, end: endDate },
              { start: dayStart, end: dayEnd },
              timezone
            );
            if (!busyRange) {
              return false;
            }

            return slotStart < busyRange.endMinutes && slotEnd > busyRange.startMinutes;
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

      const payload = await getPreScheduleSlotsPayload(access.teamId, date, access.timezone);

      return new Output(true, [], [], payload);
    } catch (error) {
      console.error("[PublicLeadFormUseCase] Erro ao buscar slots de pré-agendamento:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }
}

export const publicLeadFormUseCase = new PublicLeadFormUseCase();
