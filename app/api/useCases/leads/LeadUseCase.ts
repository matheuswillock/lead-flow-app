import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { ILeadUseCase } from "./ILeadUseCase";
import type {
  LeadCreateOptions,
  LeadCreationActivityContext,
  LeadStatusTransitionMode,
  UpdateLeadStatusTriggerInput,
} from "./ILeadUseCase";
import { ILeadRepository } from "../../infra/data/repositories/lead/ILeadRepository";
import type { LeadUpdateRepositoryInput, TransferToTeamSanitization } from "../../infra/data/repositories/lead/ILeadRepository";
import { LeadRepository } from "../../infra/data/repositories/lead/LeadRepository";
import { IProfileUseCase } from "../profiles/IProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus, ActivityType, Prisma, TeamStatusRuleType } from "@prisma/client";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";
import { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "../../v1/leads/DTO/requestToUpdateLead";
import { TransferLeadRequest } from "../../v1/leads/DTO/requestToTransferLead";
import { TransferLeadBetweenTeamsRequest } from "../../v1/leads/DTO/requestToTransferLeadBetweenTeams";
import type { TransferLeadBetweenTeamsResult } from "../../v1/leads/DTO/transferLeadBetweenTeamsResult";
import { LeadResponseDTO } from "../../v1/leads/DTO/leadResponseDTO";
import { leadFinalizedRepository } from "../../infra/data/repositories/leadFinalized/LeadFinalizedRepository";
import { leadScheduleRepository } from "../../infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { healthPlanService } from "../../services/healthPlans/HealthPlanService";
import { leadScheduleService } from "../../services/leadSchedule/LeadScheduleService";
import { cancelCalendarEvent } from "../../services/googleCalendar/GoogleCalendarService";
import { prisma } from "../../infra/data/prisma";
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from "../../v1/leads/DTO/leadValueLimits";
import { normalizeHealthPlanName } from "@/lib/healthPlans";
import { getEmailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { isManagerLikeRole } from "@/lib/roles";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import { isLostStatus } from "@/lib/leadImport/normalizers";
import { isPreScheduleSlotAvailable } from "../../services/preSchedule/PreScheduleSlotService";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Attachment } from "resend";
import { teamStatusRuleService } from "@/app/api/services/teamStatusRule/TeamStatusRuleService";
import { isGoogleConnectionActive } from "@/lib/google/connection";
import {
  resolveTransferScheduleInput,
  type ResolvedTransferSchedule,
} from "./utils/resolveTransferSchedule";
import { leadStatusTransitionFieldRequirementService } from "@/app/api/services/leadStatusTransitionFieldRequirement/LeadStatusTransitionFieldRequirementService";
import { leadStatusTransitionGateEvaluatorService } from "@/app/api/services/leadStatusTransitionGate/LeadStatusTransitionGateEvaluatorService";
import {
  buildCurrentLeadInfo,
  resolveMissingLeadFields,
} from "@/lib/leadStatusTransitionFields";
import { cnpjLookupService } from "@/app/api/services/cnpjLookup/CnpjLookupService";
import { associateProposalUseCase } from "@/app/api/useCases/associateProposal/AssociateProposalUseCase";
import { studioBotOutboxService } from "@/app/api/services/backofficeBot/StudioBotOutboxService";
import { leadCustomFieldService } from "@/app/api/services/leadCustomField/LeadCustomFieldService";
import {
  mapLeadCustomFieldDefinitionToDTO,
} from "@/app/api/infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";
import { leadCustomFieldRepository } from "@/app/api/infra/data/repositories/leadCustomField/LeadCustomFieldRepository";
import { validateLeadCustomFieldsPayload } from "@/lib/leadCustomFields/schema";
import { leadDuplicateCheckService } from "@/app/api/services/leadDuplicateCheck/LeadDuplicateCheckService";
import { teamAutomationDispatcherService } from "@/app/api/services/teamAutomation/TeamAutomationDispatcherService";

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  future_sale: "Venda Futura",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

const getStatusLabel = (status: LeadStatus) => LEAD_STATUS_LABELS[status] ?? status;

type LeadStatusTransitionBlockerType =
  | "sales_info"
  | "confirmation"
  | "meeting_heald"
  | "schedule_required"
  | "finalize_contract"
  | "future_sale_trigger"
  | "loss_reason_trigger"
  | "disabled_status"
  | "validation_error"
  | "email_required"
  | "lead_info_required"
  | "closer_required"
  | "required_documents"
  | "none";

const defaultLeadRepository = new LeadRepository();

function serializeLeadForCache<T extends { currentValue?: unknown; ticket?: unknown }>(
  lead: T | null
): T | null {
  if (!lead) {
    return null;
  }

  return {
    ...lead,
    currentValue:
      lead.currentValue != null ? Number(lead.currentValue as number | string) : null,
    ticket: lead.ticket != null ? Number(lead.ticket as number | string) : null,
  };
}

async function getCachedLeadById(leadId: string) {
  "use cache";
  cacheTag(cacheTags.lead(leadId));
  cacheLife({ stale: 30, revalidate: 60 });
  const lead = await defaultLeadRepository.findById(leadId);
  return serializeLeadForCache(lead);
}

export class LeadUseCase implements ILeadUseCase {
  constructor(
    private leadRepository: ILeadRepository,
    private profileUseCase: IProfileUseCase,
  ) {}

  async createLead(
    supabaseId: string,
    data: CreateLeadRequest,
    teamId?: string,
    creationActivityContext?: LeadCreationActivityContext,
    options?: LeadCreateOptions
  ): Promise<Output> {
    const leadOutput = await this.createLeadInternal(supabaseId, data, false, teamId, creationActivityContext);
    const shouldAutoScheduleMeeting = options?.autoScheduleMeeting !== false;

    if (!shouldAutoScheduleMeeting) {
      return leadOutput;
    }

    const createdLead = leadOutput.result as { id?: string; leadCode?: string | null } | null;
    if (!leadOutput.isValid || !createdLead?.id) {
      return leadOutput;
    }

    const hasMeetingData = !data.isTransfer && !!(data.closerId && data.meetingDate);
    if (!hasMeetingData || !teamId) {
      return leadOutput;
    }

    try {
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      if (!profileInfo) {
        return leadOutput;
      }

      const teamForSchedule = await prisma.team.findUnique({
        where: { id: teamId },
        select: { masterId: true },
      });
      if (!teamForSchedule) {
        return leadOutput;
      }

      const managerId = teamForSchedule.masterId;
      const assigneeEmail = data.assignedTo
        ? (await prisma.profile.findUnique({
            where: { id: data.assignedTo },
            select: { email: true },
          }))?.email ?? null
        : null;

      const resolvedMeetingTitle = data.meetingTitle?.trim() || `Estudo Plano de Saúde: ${data.name}`;

      const scheduleOutput = await leadScheduleService.createSchedule({
        leadId: createdLead.id,
        leadName: data.name,
        leadEmail: data.email || null,
        leadStatus: data.status || LeadStatus.new_opportunity,
        leadManagerId: managerId || profileInfo.id,
        leadAssignedTo: data.assignedTo || null,
        leadAssigneeEmail: assigneeEmail,
        leadCurrentCloserId: null,
        leadCode: createdLead.leadCode || null,
        closerId: data.closerId!,
        teamId,
        meetingDate: data.meetingDate!,
        meetingTitle: resolvedMeetingTitle,
        meetingNotes: data.meetingNotes,
        meetingLink: data.meetingLink,
        extraGuests: undefined,
        createdByProfileId: profileInfo.id,
        transitionStatusToScheduled: true,
      });

      if (!scheduleOutput.isValid) {
        return new Output(
          true,
          ["Lead criado com sucesso, mas houve um problema ao agendar a reunião."],
          scheduleOutput.errorMessages,
          leadOutput.result
        );
      }

      return new Output(
        true,
        ["Lead criado e reunião agendada com sucesso!"],
        [],
        { ...leadOutput.result, schedule: scheduleOutput.result }
      );
    } catch (scheduleError) {
      console.error("[LeadUseCase] Erro ao agendar reunião após criar lead:", scheduleError);
      return new Output(
        true,
        ["Lead criado com sucesso, mas houve um problema ao agendar a reunião."],
        [],
        leadOutput.result
      );
    }
  }

  async createLeadFromImport(supabaseId: string, data: CreateLeadRequest, teamId?: string): Promise<Output> {
    const output = await this.createLeadInternal(supabaseId, data, true, teamId, {
      body: "Lead criado via importação manual",
      payload: { source: "import_manual" },
    });

    if (output.isValid && data.status === LeadStatus.contract_finalized && output.result?.id) {
      const amount = Number(data.ticket ?? data.currentValue ?? 0);
      await leadFinalizedRepository.create({
        leadId: output.result.id,
        finalizedAt: new Date(),
        startDateAt: new Date(),
        duration: 0,
        amount,
        notes: "Lead importado como negocio fechado",
      });
    }

    return output;
  }

  private async validateAndNormalizeLeadPlans(input: {
    currentHealthPlan?: string | null;
    soldPlan?: string | null;
  }): Promise<{
    output?: Output;
    currentHealthPlan: string | null;
    soldPlan: string | null;
  }> {
    const requestedCurrentHealthPlan = input.currentHealthPlan?.trim() || null;
    const requestedSoldPlan = input.soldPlan?.trim() || null;

    const validation = await healthPlanService.validateAndCanonicalizePlans([
      requestedCurrentHealthPlan,
      requestedSoldPlan,
    ]);

    if (validation.missing.length > 0) {
      const invalidPlans = Array.from(new Set(validation.missing)).join(", ");
      return {
        output: new Output(false, [], [`Plano de saúde inválido: ${invalidPlans}`], null),
        currentHealthPlan: null,
        soldPlan: null,
      };
    }

    const currentHealthPlan = requestedCurrentHealthPlan
      ? validation.canonicalByNormalized.get(normalizeHealthPlanName(requestedCurrentHealthPlan)) || null
      : null;
    const soldPlan = requestedSoldPlan
      ? validation.canonicalByNormalized.get(normalizeHealthPlanName(requestedSoldPlan)) || null
      : null;

    return {
      currentHealthPlan,
      soldPlan,
    };
  }

  private async createLeadInternal(
    supabaseId: string,
    data: CreateLeadRequest,
    skipAutoAssign: boolean,
    teamId?: string,
    creationActivityContext?: LeadCreationActivityContext
  ): Promise<Output> {
    try {
      // Buscar informações do perfil através do ProfileUseCase
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      if (!teamId) {
        return new Output(false, [], ["Team ID é obrigatório para criar lead"], null);
      }

      const teamRecord = await prisma.team.findUnique({
        where: { id: teamId },
        select: { masterId: true },
      });

      if (!teamRecord) {
        return new Output(false, [], ["Time não encontrado"], null);
      }

      const managerId = teamRecord.masterId;

      if (typeof data.currentValue === "number" && data.currentValue > MAX_DECIMAL_VALUE) {
        return new Output(false, [], [`Valor atual deve ser menor que ${MAX_DECIMAL_LABEL}`], null);
      }

      if (typeof data.ticket === "number" && data.ticket > MAX_DECIMAL_VALUE) {
        return new Output(false, [], [`Ticket deve ser menor que ${MAX_DECIMAL_LABEL}`], null);
      }

      const normalizedPlans = await this.validateAndNormalizeLeadPlans({
        currentHealthPlan: data.currentHealthPlan,
        soldPlan: data.soldPlan,
      });
      if (normalizedPlans.output) {
        return normalizedPlans.output;
      }

      if (data.cnpj && data.cnpj.trim().length > 0) {
        const existingLead = await prisma.lead.findFirst({
          where: { teamId, cnpj: data.cnpj.trim() },
          select: { id: true, leadCode: true, name: true },
        });
        if (existingLead) {
          return new Output(
            false,
            [],
            [`Já existe um lead com este CNPJ neste time (${existingLead.leadCode ?? existingLead.name ?? existingLead.id})`],
            null
          );
        }
      }

      if (data.phone || data.email) {
        const duplicateCandidates = await leadDuplicateCheckService.findCandidates(
          {
            profileId: profileInfo.id,
            teamMember: {
              role: profileInfo.role,
              functions: [],
            },
          },
          {
            teamId,
            phone: data.phone,
            email: data.email,
          }
        );

        if (duplicateCandidates.length > 0 && data.confirmDuplicate !== true) {
          return new Output(
            false,
            [],
            ["Possível lead duplicado neste time"],
            {
              requiresDuplicateConfirmation: true,
              duplicateCandidates: duplicateCandidates.map((candidate) => ({
                ...candidate,
                createdAt: candidate.createdAt.toISOString(),
              })),
            }
          );
        }
      }

      const saveAsDraft = data.saveAsDraft === true;
      const isTransferLead = data.isTransfer === true;
      if (isTransferLead && !saveAsDraft) {
        if (data.closerId) {
          return new Output(
            false,
            [],
            ["Não é possível atribuir closer em lead com transferência ativa na criação."],
            null
          );
        }
        if (data.status === LeadStatus.scheduled) {
          return new Output(
            false,
            [],
            ["Lead com transferência ativa não pode ser criado com status Agendado."],
            null
          );
        }
        if (!data.meetingDate) {
          return new Output(
            false,
            [],
            ["Selecione uma data para o pré-agendamento da transferência."],
            null
          );
        }
        const meetingDate = new Date(data.meetingDate);
        const slotCheck = await isPreScheduleSlotAvailable(teamId, meetingDate);
        if (!slotCheck.available) {
          return new Output(false, [], ["Este horário de pré-agendamento já está lotado."], null);
        }
      }

      const leadStatus = saveAsDraft
        ? null
        : isTransferLead
          ? LeadStatus.new_opportunity
          : data.status || LeadStatus.new_opportunity;

      const leadCode = await this.generateLeadCode(data.name);

      if (data.customFields !== undefined) {
        const customFieldsValidation = await this.validateLeadCustomFieldsInput(teamId, data.customFields);
        if (customFieldsValidation) {
          return customFieldsValidation;
        }
      }

      let assignedTo = skipAutoAssign ? undefined : data.assignedTo;
      if (!skipAutoAssign && profileInfo.role === "operator" && !assignedTo) {
        assignedTo = profileInfo.id;
      }

      const lead = await this.leadRepository.create({
        manager: { connect: { id: managerId } },
        team: { connect: { id: teamId } },
        leadCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        cnpj: data.cnpj || null,
        // Razão social é resolvida em background após a criação (ver enrichLeadRazaoSocial).
        razaoSocial: null,
        age: data.age || null,
        currentHealthPlan: normalizedPlans.currentHealthPlan,
        currentValue: data.currentValue || null,
        referenceHospital: data.referenceHospital || null,
        currentTreatment: data.currentTreatment || null,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : null,
        meetingTitle: data.meetingTitle || null,
        meetingNotes: data.meetingNotes || null,
        meetingLink: data.meetingLink || null,
        meetingHeald: data.meetingHeald || null,
        notes: data.notes || null,
        status: leadStatus,
        isTransfer: isTransferLead,
        // Novos campos de venda (sempre null na criação)
        ticket: data.ticket || null,
        contractDueDate: data.contractDueDate ? new Date(data.contractDueDate) : null,
        soldPlan: normalizedPlans.soldPlan,
        // Meeting type & referral fields
        meetingType: data.meetingType || null,
        isReferral: data.isReferral ?? null,
        referrerName: data.referrerName || null,
        referrerPhone: data.referrerPhone || null,
        ...(data.referrerLeadId
          ? { referrerLead: { connect: { id: data.referrerLeadId } } }
          : {}),
        creator: { connect: { id: profileInfo.id } },
        updater: { connect: { id: profileInfo.id } },
        ...(assignedTo && {
          assignee: { connect: { id: assignedTo } }
        }),
        ...(data.closerId && !isTransferLead && {
          closer: { connect: { id: data.closerId } }
        }),
        activities: {
          create: creationActivityContext?.authorAsStudio
            ? buildStudioActivityData({
                type: ActivityType.note,
                body: saveAsDraft
                  ? "Rascunho criado"
                  : creationActivityContext?.body || "Lead criado no sistema",
                payload:
                  creationActivityContext?.payload === null
                    ? null
                    : (creationActivityContext?.payload ?? undefined),
              })
            : {
                type: ActivityType.note,
                body: saveAsDraft
                  ? "Rascunho criado"
                  : creationActivityContext?.body || "Lead criado no sistema",
                payload:
                  creationActivityContext?.payload === null
                    ? Prisma.JsonNull
                    : (creationActivityContext?.payload ?? undefined),
                author: { connect: { id: profileInfo.id } },
              },
        },
      });

      if (lead.isTransfer === true && lead.meetingDate && lead.status !== null) {
        await this.ensureTransferPreSchedule(lead);
      }

      if (lead.isTransfer === true && lead.status !== null) {
        this.handleTransferActivationAlert(lead).catch((err) =>
          console.error("[LeadUseCase][handleTransferActivationAlert] Background error:", err)
        );
      }

      if (assignedTo) {
        this.enqueueLeadAssignedPush(
          { id: lead.id, leadCode: lead.leadCode ?? null, name: lead.name },
          assignedTo,
        );
      }

      if (lead.status !== null) {
        teamAutomationDispatcherService
          .dispatch({
            type: "lead_created",
            teamId,
            leadId: lead.id,
          })
          .catch(console.error);
      }

      if (data.customFields !== undefined) {
        await leadCustomFieldRepository.upsertValuesForLead(
          lead.id,
          await this.buildCustomFieldUpsertEntries(teamId, data.customFields)
        );
      }

      return new Output(
        true,
        ["Lead criado com sucesso"],
        [],
        await this.attachCustomFieldsToDto(lead.id, this.transformToDTO(lead))
      );
    } catch (error) {
      console.error("Erro ao criar lead:", error);
      
      // Detectar erros específicos do Prisma
      if (error instanceof Error) {
        // Erro de unique constraint (campos unicos do lead)
        if (error.message.includes('Unique constraint') || error.message.includes('unique constraint')) {
          const normalizedError = error.message.toLowerCase();

          if (normalizedError.includes("teamid_email") || normalizedError.includes("email")) {
            return new Output(false, [], ["Ja existe um lead com este e-mail"], null);
          }

          if (normalizedError.includes("teamid_cnpj") || normalizedError.includes("cnpj")) {
            return new Output(false, [], ["Ja existe um lead com este CNPJ"], null);
          }

          return new Output(false, [], ["Ja existe um lead com estes dados unicos"], null);
        }
        
        // Erro de validação
        if (error.message.includes('validation') || error.message.includes('Invalid')) {
          return new Output(false, [], [`Dados inválidos: ${error.message}`], null);
        }
        
        // Erro de foreign key (relacionamento inválido)
        if (error.message.includes('Foreign key constraint')) {
          return new Output(false, [], ["Erro: Dados de relacionamento inválidos"], null);
        }
      }
      
      return new Output(false, [], ["Erro interno do servidor ao criar lead"], null);
    }
  }

  private async generateLeadCode(name: string): Promise<string> {
    const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const firstLetter = (clean[0] || "L").toUpperCase();
    const lastLetter = (clean[clean.length - 1] || "D").toUpperCase();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const digitsLength = 4 + Math.floor(Math.random() * 3); // 4-6
      const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join("");
      const code = `${firstLetter}${digits}${lastLetter}`;
      const existing = await this.leadRepository.findByLeadCode(code);
      if (!existing) {
        return code;
      }
    }

    const fallbackDigits = Date.now().toString().slice(-6);
    return `${firstLetter}${fallbackDigits}${lastLetter}`;
  }

  async getLeadById(supabaseId: string, id: string, resolvedProfileId?: string): Promise<Output> {
    try {
      // Quando o caller já resolveu o profileId (ex.: rota de details), evita
      // repetir o profile.findUnique via ProfileUseCase.
      let profileId = resolvedProfileId;
      if (!profileId) {
        const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
        if (!profileInfo) {
          return new Output(false, [], ["Perfil do usuário não encontrado"], null);
        }
        profileId = profileInfo.id;
      }

      const lead = await getCachedLeadById(id);

      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      return new Output(true, [], [], await this.attachCustomFieldsToDto(id, this.transformToDTO(lead, profileId)));
    } catch (error) {
      console.error("Erro ao buscar lead:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async getLeadsByManager(
    supabaseId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      page?: number;
      limit?: number;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
    }
  ): Promise<Output> {
    try {
      // Buscar informações do perfil através do ProfileUseCase
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const managerId = isManagerLikeRole(profileInfo.role) ? profileInfo.id : profileInfo.managerId;
      
      if (!managerId) {
        return new Output(false, [], ["Manager não identificado"], null);
      }

      const { leads, total } = await this.leadRepository.findByManagerId(managerId, options);
      const { page = 1, limit = 10 } = options || {};
      
      const result = {
        leads: leads.map(lead => this.transformToDTO(lead)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      return new Output(true, [], [], result);
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async getAllLeadsByUserRoleWithCtx(
    access: TeamAccess,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
    }
  ): Promise<Output> {
    try {
      const teamId = access.teamId;
      const teamRole = access.teamMember.role;
      let leads: Awaited<ReturnType<ILeadRepository["findAllByTeamId"]>>["leads"] = [];

      if (isManagerLikeRole(teamRole)) {
        const result = await this.leadRepository.findAllByTeamId(teamId, {
          status: options?.status,
          assignedTo: options?.assignedTo,
          search: options?.search,
          startDate: options?.startDate,
          endDate: options?.endDate,
          onlyTransfer: options?.onlyTransfer,
          calendarWindowStart: options?.calendarWindowStart,
          calendarWindowEnd: options?.calendarWindowEnd,
        });
        leads = result.leads;
      } else if (teamRole === "operator") {
        const result = await this.leadRepository.findAllByOperatorIdInTeam(access.profileId, teamId, {
          status: options?.status,
          assignedTo: options?.assignedTo,
          search: options?.search,
          startDate: options?.startDate,
          endDate: options?.endDate,
          onlyTransfer: options?.onlyTransfer,
          calendarWindowStart: options?.calendarWindowStart,
          calendarWindowEnd: options?.calendarWindowEnd,
        });
        leads = result.leads;
      } else {
        return new Output(false, [], ["Role inválido. Use 'manager', 'backoffice' ou 'operator'"], null);
      }

      return new Output(true, [], [], leads.map((lead) => this.transformToDTO(lead)));
    } catch (error) {
      console.error("[LeadUseCase][getAllLeadsByUserRoleWithCtx] Erro ao buscar leads:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async getAllLeadsByUserRole(
    supabaseId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
      role: string;
      teamId?: string;
    }
  ): Promise<Output> {
    try {
      // Buscar informações do perfil através do ProfileUseCase
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const teamId = options?.teamId;
      if (!teamId) {
        return new Output(false, [], ["Team ID é obrigatório"], null);
      }

      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_profileId: {
            teamId,
            profileId: profileInfo.id
          }
        },
        select: {
          role: true,
          functions: true
        }
      });

      if (!membership) {
        return new Output(false, [], ["Sem acesso ao time ativo"], null);
      }

      let leads: any[] = [];
      const teamRole = membership.role;

      if (isManagerLikeRole(teamRole)) {
        const result = await this.leadRepository.findAllByTeamId(teamId, {
          status: options.status,
          assignedTo: options.assignedTo,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
          onlyTransfer: options.onlyTransfer,
          calendarWindowStart: options.calendarWindowStart,
          calendarWindowEnd: options.calendarWindowEnd,
        });

        leads = result.leads;
      } else if (teamRole === 'operator') {
        const result = await this.leadRepository.findAllByOperatorIdInTeam(profileInfo.id, teamId, {
          status: options.status,
          assignedTo: options.assignedTo,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
          onlyTransfer: options.onlyTransfer,
          calendarWindowStart: options.calendarWindowStart,
          calendarWindowEnd: options.calendarWindowEnd,
        });

        leads = result.leads;
      } else {
        return new Output(false, [], ["Role inválido. Use 'manager', 'backoffice' ou 'operator'"], null);
      }

      return new Output(true, [], [], leads.map(lead => this.transformToDTO(lead)));
    } catch (error) {
      console.error("Erro ao buscar leads por role:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async updateLead(supabaseId: string, id: string, data: UpdateLeadRequest): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }
      const actorLabel = profileInfo.fullName || profileInfo.email || "Usuário";

      const shouldTrackAssignment = data.assignedTo !== undefined;
      const shouldTrackMeetingHeald = data.meetingHeald !== undefined;
      const shouldTrackMeetingPresence = data.meetingPresenceConfirmed !== undefined;
      const shouldTrackStatus = data.status !== undefined;
      const shouldCheckCnpj = data.cnpj !== undefined && !!data.cnpj;
      const shouldTrackTransfer = data.isTransfer === true;
      const shouldTrackChanges =
        shouldTrackAssignment ||
        data.closerId !== undefined ||
        shouldTrackMeetingHeald ||
        shouldTrackMeetingPresence ||
        shouldTrackStatus ||
        shouldCheckCnpj ||
        shouldTrackTransfer;
      const existingLead = shouldTrackChanges ? await this.leadRepository.findById(id) : null;
      if (shouldTrackChanges && !existingLead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      const autoClearCloserOnTransfer =
        data.isTransfer === true &&
        !!existingLead &&
        existingLead.isTransfer !== true &&
        !!existingLead.closerId;
      const shouldTrackCloser = data.closerId !== undefined || autoClearCloserOnTransfer;

      if (shouldCheckCnpj && existingLead) {
        const cnpjConflict = await prisma.lead.findFirst({
          where: { teamId: existingLead.teamId!, cnpj: data.cnpj, NOT: { id } },
          select: { id: true, leadCode: true, name: true },
        });
        if (cnpjConflict) {
          return new Output(
            false,
            [],
            [`Já existe um lead com este CNPJ neste time (${cnpjConflict.leadCode ?? cnpjConflict.name})`],
            null
          );
        }
      }

      if (existingLead) {
        const effectiveIsTransfer =
          data.isTransfer !== undefined ? data.isTransfer === true : existingLead.isTransfer === true;

        if (effectiveIsTransfer) {
          if (data.status === LeadStatus.scheduled) {
            return new Output(
              false,
              [],
              ["Lead com transferência ativa não pode ser marcado como Agendado. Conclua a transferência primeiro."],
              null
            );
          }
          if (data.closerId !== undefined && data.closerId) {
            return new Output(
              false,
              [],
              ["Não é possível atribuir closer enquanto a transferência estiver ativa. Conclua a transferência primeiro."],
              null
            );
          }
        }

        if (data.isTransfer === true && existingLead.status === LeadStatus.scheduled) {
          return new Output(
            false,
            [],
            ["Não é possível ativar transferência em lead com status Agendado."],
            null
          );
        }
      }

      const leadForDraft = await this.leadRepository.findById(id);
      if (!leadForDraft) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      const saveAsDraft = data.saveAsDraft === true;
      const isExistingDraft = leadForDraft.status === null;

      if (!isExistingDraft && saveAsDraft) {
        return new Output(false, [], ["Não é possível converter um lead ativo em rascunho."], null);
      }

      if (data.customFields !== undefined && leadForDraft.teamId) {
        const customFieldsValidation = await this.validateLeadCustomFieldsInput(
          leadForDraft.teamId,
          data.customFields
        );
        if (customFieldsValidation) {
          return customFieldsValidation;
        }
      }

      const effectiveIsTransferForSave =
        data.isTransfer !== undefined ? data.isTransfer === true : leadForDraft.isTransfer === true;
      const resolvedMeetingDate =
        data.meetingDate !== undefined
          ? data.meetingDate
            ? new Date(data.meetingDate)
            : null
          : leadForDraft.meetingDate;

      if (!saveAsDraft && effectiveIsTransferForSave && !resolvedMeetingDate) {
        return new Output(
          false,
          [],
          ["Selecione uma data para o pré-agendamento da transferência."],
          null
        );
      }

      if (
        !saveAsDraft &&
        effectiveIsTransferForSave &&
        resolvedMeetingDate &&
        leadForDraft.teamId
      ) {
        const slotCheck = await isPreScheduleSlotAvailable(
          leadForDraft.teamId,
          resolvedMeetingDate,
          undefined,
          id
        );
        if (!slotCheck.available) {
          return new Output(false, [], ["Este horário de pré-agendamento já está lotado."], null);
        }
      }

      const updateData: LeadUpdateRepositoryInput = {};
      const shouldValidateHealthPlans = data.currentHealthPlan !== undefined || data.soldPlan !== undefined;
      const normalizedPlans = shouldValidateHealthPlans
        ? await this.validateAndNormalizeLeadPlans({
            currentHealthPlan: data.currentHealthPlan,
            soldPlan: data.soldPlan,
          })
        : null;
      if (normalizedPlans?.output) {
        return normalizedPlans.output;
      }
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.cnpj !== undefined) {
        const nextCnpj = data.cnpj?.trim() || null;
        const previousCnpj = leadForDraft.cnpj?.trim() || null;
        const previousRazaoSocial = leadForDraft.razaoSocial?.trim() || null;

        updateData.cnpj = nextCnpj;
        if (!nextCnpj) {
          // CNPJ removido: não pode existir razão social sem CNPJ.
          updateData.razaoSocial = null;
        } else if (nextCnpj === previousCnpj && previousRazaoSocial) {
          // CNPJ inalterado e já tínhamos razão social: reaproveita, sem custo de rede.
          updateData.razaoSocial = previousRazaoSocial;
        } else {
          // CNPJ novo/alterado (ou ainda sem razão social resolvida): limpa até o
          // enriquecimento em background terminar — nunca mostrar razão social
          // que pertence ao CNPJ antigo.
          updateData.razaoSocial = null;
        }
      }
      if (data.age !== undefined) updateData.age = data.age;
      if (data.currentHealthPlan !== undefined) updateData.currentHealthPlan = normalizedPlans?.currentHealthPlan || null;
      if (data.currentValue !== undefined) updateData.currentValue = data.currentValue;
      if (data.referenceHospital !== undefined) updateData.referenceHospital = data.referenceHospital || null;
      if (data.currentTreatment !== undefined) updateData.currentTreatment = data.currentTreatment || null;
      if (data.meetingDate !== undefined) {
        const nextMeetingDate = data.meetingDate ? new Date(data.meetingDate) : null;
        const previousMeetingDate = existingLead?.meetingDate ?? null;
        const meetingDateChanged =
          (nextMeetingDate?.getTime() ?? null) !== (previousMeetingDate?.getTime() ?? null);
        updateData.meetingDate = nextMeetingDate;
        if (meetingDateChanged) {
          updateData.meetingPresenceConfirmed = false;
          updateData.meetingPresenceConfirmedAt = null;
        }
      }
      if (data.meetingTitle !== undefined) updateData.meetingTitle = data.meetingTitle || null;
      if (data.meetingNotes !== undefined) updateData.meetingNotes = data.meetingNotes || null;
      if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
      if (data.meetingHeald !== undefined) updateData.meetingHeald = data.meetingHeald || null;
      if (data.meetingPresenceConfirmed !== undefined) {
        if (data.meetingPresenceConfirmed === true) {
          const effectiveStatus = data.status ?? existingLead?.status;
          const effectiveIsTransfer =
            data.isTransfer !== undefined ? data.isTransfer === true : existingLead?.isTransfer === true;
          const effectiveMeetingDate =
            data.meetingDate !== undefined
              ? data.meetingDate
                ? new Date(data.meetingDate)
                : null
              : existingLead?.meetingDate ?? null;

          if (effectiveStatus !== LeadStatus.scheduled) {
            return new Output(false, [], ["Só é possível confirmar agenda para leads agendados."], null);
          }
          if (effectiveIsTransfer) {
            return new Output(false, [], ["Pré-agendamento de transferência não pode ser confirmado como agenda."], null);
          }
          if (!effectiveMeetingDate || effectiveMeetingDate.getTime() <= Date.now()) {
            return new Output(false, [], ["Só é possível confirmar agenda antes do horário da reunião."], null);
          }

          updateData.meetingPresenceConfirmed = true;
          updateData.meetingPresenceConfirmedAt = new Date();
        } else {
          updateData.meetingPresenceConfirmed = false;
          updateData.meetingPresenceConfirmedAt = null;
        }
      }
      if (data.isTransfer !== undefined) updateData.isTransfer = data.isTransfer === true;
      if (autoClearCloserOnTransfer && data.closerId === undefined) {
        updateData.closer = { disconnect: true };
      }
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined && !isExistingDraft && !saveAsDraft) updateData.status = data.status;
      if (isExistingDraft || data.saveAsDraft !== undefined) {
        if (saveAsDraft) {
          updateData.status = null;
        } else if (isExistingDraft) {
          updateData.status = effectiveIsTransferForSave
            ? LeadStatus.new_opportunity
            : data.status ?? LeadStatus.new_opportunity;
          updateData.statusEnteredAt = new Date();
        }
      }
      // Novos campos de venda
      if (data.ticket !== undefined) updateData.ticket = data.ticket;
      if (data.contractDueDate !== undefined) updateData.contractDueDate = data.contractDueDate ? new Date(data.contractDueDate) : null;
      if (data.soldPlan !== undefined) updateData.soldPlan = normalizedPlans?.soldPlan || null;
      // Meeting type & referral fields
      if (data.meetingType !== undefined) updateData.meetingType = data.meetingType || null;
      if (data.isReferral !== undefined) updateData.isReferral = data.isReferral ?? null;
      if (data.referrerLeadId !== undefined) {
        if (data.referrerLeadId) {
          updateData.referrerLead = { connect: { id: data.referrerLeadId } };
        } else {
          updateData.referrerLead = { disconnect: true };
        }
      }
      if (data.referrerName !== undefined) updateData.referrerName = data.referrerName || null;
      if (data.referrerPhone !== undefined) updateData.referrerPhone = data.referrerPhone || null;
      if (data.assignedTo !== undefined) {
        if (data.assignedTo) {
          updateData.assignee = { connect: { id: data.assignedTo } };
        } else {
          updateData.assignee = { disconnect: true };
        }
      }
      if (data.closerId !== undefined) {
        if (data.closerId) {
          updateData.closer = { connect: { id: data.closerId } };
        } else {
          updateData.closer = { disconnect: true };
        }
      }

      // Sempre atualizar o campo updater
      updateData.updater = { connect: { id: profileInfo.id } };

      const lead = await this.leadRepository.update(id, updateData);
      const leadWithRelations = lead as typeof lead & {
        assignee?: { fullName?: string | null; email?: string | null };
        closer?: { fullName?: string | null; email?: string | null };
      };

      if (shouldTrackAssignment && existingLead?.assignedTo !== data.assignedTo) {
        const assigneeLabel =
          leadWithRelations.assignee?.fullName ||
          leadWithRelations.assignee?.email ||
          "Responsável";
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.note,
              body: `Lead atribuído para ${assigneeLabel}`,
              payload: {
                previousAssignedTo: existingLead?.assignedTo ?? null,
                assignedTo: data.assignedTo ?? null,
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de atribuição:", error);
        }

        if (data.assignedTo) {
          this.enqueueLeadAssignedPush(
            { id: lead.id, leadCode: lead.leadCode ?? null, name: lead.name },
            data.assignedTo,
          );
        }
      }

      const resolvedCloserId =
        data.closerId !== undefined ? data.closerId ?? null : autoClearCloserOnTransfer ? null : undefined;
      if (
        shouldTrackCloser &&
        resolvedCloserId !== undefined &&
        existingLead?.closerId !== resolvedCloserId
      ) {
        const closerLabel = resolvedCloserId
          ? (leadWithRelations.closer?.fullName || leadWithRelations.closer?.email || "Closer")
          : "Nenhum closer";
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.note,
              body: `Closer alterado para ${closerLabel}`,
              payload: {
                previousCloserId: existingLead?.closerId ?? null,
                closerId: resolvedCloserId,
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de alteração de closer:", error);
        }
      }

      if (
        shouldTrackMeetingHeald &&
        existingLead?.meetingHeald !== data.meetingHeald &&
        data.meetingHeald === "yes"
      ) {
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.note,
              body: `Reunião marcada como realizada por ${actorLabel}`,
              payload: {
                previousMeetingHeald: existingLead?.meetingHeald ?? null,
                meetingHeald: data.meetingHeald ?? null,
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de reunião realizada:", error);
        }
      }

      if (
        shouldTrackMeetingPresence &&
        existingLead?.meetingPresenceConfirmed !== data.meetingPresenceConfirmed &&
        data.meetingPresenceConfirmed === true
      ) {
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.note,
              body: "Presença confirmada com o lead para a reunião.",
              payload: {
                previousMeetingPresenceConfirmed: existingLead?.meetingPresenceConfirmed ?? false,
                meetingPresenceConfirmed: true,
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de confirmação de agenda:", error);
        }
      }

      if (
        shouldTrackStatus &&
        existingLead &&
        existingLead.status &&
        lead.status &&
        existingLead.status !== lead.status
      ) {
        await this.handleOfferSubmissionAlert({
          lead,
          previousStatus: existingLead.status,
          nextStatus: lead.status,
          actorProfileId: profileInfo.id,
          actorName: actorLabel,
        }).catch((err) => console.error("[LeadUseCase][handleOfferSubmissionAlert] Background error:", err));
      }

      if (data.isTransfer === true && existingLead && !existingLead.isTransfer) {
        this.handleTransferActivationAlert(lead).catch((err) =>
          console.error("[LeadUseCase][handleTransferActivationAlert] Background error:", err)
        );
      }

      if (data.customFields !== undefined && leadForDraft.teamId) {
        await leadCustomFieldRepository.upsertValuesForLead(
          id,
          await this.buildCustomFieldUpsertEntries(leadForDraft.teamId, data.customFields)
        );
      }

      return new Output(
        true,
        ["Lead atualizado com sucesso"],
        [],
        await this.attachCustomFieldsToDto(id, this.transformToDTO(lead))
      );
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      return new Output(false, [], ["Erro interno do servidor ao atualizar lead"], null);
    }
  }

  async deleteLead(supabaseId: string, id: string): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        console.error("[LeadUseCase][deleteLead] Perfil não encontrado para supabaseId:", supabaseId);
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const existingLead = await this.leadRepository.findById(id);
      if (!existingLead) {
        console.error("[LeadUseCase][deleteLead] Lead não encontrado:", id);
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      if (profileInfo.role === 'operator' && existingLead.createdBy !== profileInfo.id) {
        console.error("[LeadUseCase][deleteLead] Operador sem permissão:", { supabaseId, leadId: id, createdBy: existingLead.createdBy });
        return new Output(false, [], ["Você só pode deletar leads que você criou"], null);
      }

      const schedule = await leadScheduleRepository.findLatestByLeadId(id);
      let calendarWarning: string | null = null;

      if (schedule?.googleEventId) {
        if (!existingLead.closerId) {
          calendarWarning =
            "Closer do agendamento não encontrado. Evento não foi cancelado no Google Calendar.";
        }

        if (existingLead.closerId) {
          const closerProfile = await prisma.profile.findUnique({
            where: { id: existingLead.closerId },
            include: {
              googleConnection: {
                select: {
                  accessToken: true,
                  refreshToken: true,
                  tokenExpiresAt: true,
                  revokedAt: true,
                },
              },
            },
          });
          const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile?.googleConnection);

          if (!closerProfile || !canUseGoogleCalendar) {
            calendarWarning =
              "Conta Google do closer não está conectada. Evento não foi cancelado no Google Calendar.";
          }

          if (closerProfile && canUseGoogleCalendar) {
            try {
              await cancelCalendarEvent({
                organizer: closerProfile,
                eventId: schedule.googleEventId,
                calendarId: schedule.googleCalendarId ?? "primary",
              });
            } catch (calendarError) {
              calendarWarning =
                calendarError instanceof Error
                  ? calendarError.message
                  : "Falha ao cancelar evento no Google Calendar";
            }
          }
        }
      }

      await prisma.$transaction(async (tx) => {
        if (schedule) {
          await tx.leadsSchedule.delete({
            where: { id: schedule.id },
          });
        }

        await tx.lead.delete({
          where: { id },
        });
      });

      const successMessages = ["Lead excluído com sucesso"];
      if (calendarWarning) {
        successMessages.push("Aviso: evento no Google Calendar não foi removido.");
      }
      return new Output(true, successMessages, [], null);
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      return new Output(false, [], ["Erro interno do servidor ao excluir lead"], null);
    }
  }

  async updateLeadStatus(
    supabaseId: string,
    id: string,
    status: LeadStatus,
    trigger?: UpdateLeadStatusTriggerInput,
    mode: LeadStatusTransitionMode = "apply"
  ): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }
      const actorLabel = profileInfo.fullName || profileInfo.email || "Usuário";

      // Buscar o lead para obter informações
      const existingLead = await this.leadRepository.findById(id);
      
      if (!existingLead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      const createTransition = (
        allowed: boolean,
        blockerType: LeadStatusTransitionBlockerType,
        extra: Record<string, unknown> = {}
      ) => ({
        allowed,
        blockerType,
        sourceStatus: existingLead.status,
        targetStatus: status,
        ...extra,
      });

      if (status === LeadStatus.contract_finalized) {
        const earlyGate = await leadStatusTransitionGateEvaluatorService.evaluate({
          lead: existingLead,
          targetStatus: status,
          trigger,
          mode,
          profileInfo,
          createTransition,
          sortOrderRange: { max: 5 },
        });
        if ("errorMessages" in earlyGate) {
          return new Output(false, [], earlyGate.errorMessages, earlyGate.result);
        }
      }

      const requiredTransitionFields =
        await leadStatusTransitionFieldRequirementService.getRequiredFieldsByTargetStatus(status);
      const missingLeadFields = resolveMissingLeadFields(
        {
          age: existingLead.age,
          currentHealthPlan: existingLead.currentHealthPlan,
          referenceHospital: existingLead.referenceHospital,
          currentTreatment: existingLead.currentTreatment,
          email: existingLead.email,
          phone: existingLead.phone,
          cnpj: existingLead.cnpj,
        },
        requiredTransitionFields
      );

      if (missingLeadFields.length > 0) {
        const currentLeadInfo = buildCurrentLeadInfo({
          age: existingLead.age,
          currentHealthPlan: existingLead.currentHealthPlan,
          referenceHospital: existingLead.referenceHospital,
          currentTreatment: existingLead.currentTreatment,
          email: existingLead.email,
          phone: existingLead.phone,
          cnpj: existingLead.cnpj,
        });
        return new Output(
          false,
          [],
          [
            status === LeadStatus.pricingRequest
              ? "Preencha as informações do lead para continuar para Cotação."
              : "Preencha as informações do lead para continuar a mudança de status.",
          ],
          {
            missingLeadFields,
            currentLeadInfo,
            sourceStatus: existingLead.status,
            targetStatus: status,
            transition: createTransition(false, "lead_info_required", {
              missingLeadFields,
              currentLeadInfo,
            }),
          }
        );
      }

      const statusUpdateExtraData: Prisma.LeadUpdateInput = {};
      const transitionWarnings: string[] = [];

      const gateEvaluation = await leadStatusTransitionGateEvaluatorService.evaluate({
        lead: existingLead,
        targetStatus: status,
        trigger,
        mode,
        profileInfo,
        createTransition,
        sortOrderRange: { min: 10 },
      });

      if ("errorMessages" in gateEvaluation) {
        return new Output(false, [], gateEvaluation.errorMessages, gateEvaluation.result);
      }

      Object.assign(statusUpdateExtraData, gateEvaluation.statusUpdatePatch);

      const activeStatusRules = existingLead.teamId
        ? await teamStatusRuleService.findActiveByTargetStatus(existingLead.teamId, status)
        : [];

      const disabledStatusRule = activeStatusRules.find(
        (rule) => rule.type === TeamStatusRuleType.disabled_status
      );
      if (disabledStatusRule) {
        return new Output(
          false,
          [],
          [`O status ${getStatusLabel(status)} está desabilitado para este time.`],
          {
            transition: createTransition(false, "disabled_status"),
          }
        );
      }

      const combinedTransitionRules = activeStatusRules.filter(
        (rule) =>
          rule.type === TeamStatusRuleType.combined_transition &&
          rule.requiredStatus
      );

      if (combinedTransitionRules.length > 0) {
        // OR logic: transition is allowed when the current status satisfies ANY rule.
        const anySatisfied = combinedTransitionRules.some(
          (rule) => existingLead.status === rule.requiredStatus
        );

        if (!anySatisfied) {
          // Allow if the user already confirmed any rule in this set.
          const alreadyConfirmed = combinedTransitionRules.some(
            (rule) => rule.requireConfirmation && trigger?.confirmRuleId === rule.id
          );

          if (!alreadyConfirmed) {
            // Surface the first confirmation rule if available, otherwise the first blocking rule.
            const ruleToSurface =
              combinedTransitionRules.find((rule) => rule.requireConfirmation) ??
              combinedTransitionRules[0]!;

            const defaultConfirmationMessage = `Regra de transição: confirme mover para ${getStatusLabel(
              status
            )} sem o pré-requisito ${getStatusLabel(ruleToSurface.requiredStatus!)}.`;
            const defaultBlockingMessage = `Regra de transição: o lead só pode ser movido para ${getStatusLabel(
              status
            )} quando estiver em ${getStatusLabel(ruleToSurface.requiredStatus!)}.`;

            if (ruleToSurface.requireConfirmation) {
              return new Output(false, [], [ruleToSurface.confirmationMessage || defaultConfirmationMessage], {
                requiresConfirmation: true,
                confirmationRuleId: ruleToSurface.id,
                targetStatus: status,
                requiredStatus: ruleToSurface.requiredStatus,
                confirmationMessage: ruleToSurface.confirmationMessage || null,
                transition: createTransition(false, "confirmation", {
                  confirmationRuleId: ruleToSurface.id,
                  confirmationMessage: ruleToSurface.confirmationMessage || null,
                }),
              });
            }

            return new Output(false, [], [ruleToSurface.confirmationMessage || defaultBlockingMessage], {
              requiresConfirmation: false,
              targetStatus: status,
              requiredStatus: ruleToSurface.requiredStatus,
              transition: createTransition(false, "validation_error"),
            });
          }
        }
      }

      const shouldCleanupScheduledOnRevert =
        existingLead.status === LeadStatus.scheduled &&
        status === LeadStatus.new_opportunity;

      if (shouldCleanupScheduledOnRevert && mode === "apply") {
        const schedule = await leadScheduleRepository.findLatestByLeadId(id);

        if (schedule?.googleEventId) {
          if (!existingLead.closerId) {
            transitionWarnings.push(
              "Closer do agendamento não encontrado. Evento não foi cancelado no Google Calendar."
            );
          } else {
            const closerProfile = await prisma.profile.findUnique({
              where: { id: existingLead.closerId },
              include: {
                googleConnection: {
                  select: {
                    accessToken: true,
                    refreshToken: true,
                    tokenExpiresAt: true,
                    revokedAt: true,
                  },
                },
              },
            });
            const canUseGoogleCalendar = isGoogleConnectionActive(closerProfile?.googleConnection);

            if (!closerProfile || !canUseGoogleCalendar) {
              transitionWarnings.push(
                "Conta Google do closer não está conectada. Evento não foi cancelado no Google Calendar."
              );
            } else {
              try {
                await cancelCalendarEvent({
                  organizer: closerProfile,
                  eventId: schedule.googleEventId,
                  calendarId: schedule.googleCalendarId ?? "primary",
                });
              } catch (calendarError) {
                transitionWarnings.push(
                  calendarError instanceof Error
                    ? calendarError.message
                    : "Falha ao cancelar evento no Google Calendar."
                );
              }
            }
          }
        }

        if (schedule) {
          await leadScheduleRepository.delete(schedule.id);
        }

        statusUpdateExtraData.meetingDate = null;
        statusUpdateExtraData.meetingTitle = null;
        statusUpdateExtraData.meetingNotes = null;
        statusUpdateExtraData.meetingLink = null;
        statusUpdateExtraData.meetingHeald = null;
        statusUpdateExtraData.meetingPresenceConfirmed = false;
        statusUpdateExtraData.meetingPresenceConfirmedAt = null;
      }

      if (status !== existingLead.status) {
        statusUpdateExtraData.statusEnteredAt = new Date();
      }

      if (mode === "validate") {
        return new Output(
          true,
          ["Transição validada com sucesso."],
          [],
          {
            transition: createTransition(true, "none"),
          }
        );
      }

      // Atualizar o status do lead
      const lead = await this.leadRepository.updateStatus(id, status, statusUpdateExtraData);

      if (existingLead.status && existingLead.status !== status) {
        const fromLabel = getStatusLabel(existingLead.status);
        const toLabel = getStatusLabel(status);
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.status_change,
              body: `Status alterado de ${fromLabel} para ${toLabel}`,
              payload: {
                from: existingLead.status,
                to: status,
                fromLabel,
                toLabel,
                ...(status === LeadStatus.future_sale && {
                  followUpAt: lead.followUpAt ? lead.followUpAt.toISOString() : null,
                  followUpNotes: lead.followUpNotes || null,
                }),
                ...((status === LeadStatus.opportunityLost || status === LeadStatus.operator_denied) && {
                  lossReason: lead.lossReason || null,
                  lossReasonDetails: lead.lossReasonDetails || null,
                }),
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de status:", error);
        }

        if (status === LeadStatus.no_show) {
          try {
            await prisma.leadActivity.create({
              data: {
                leadId: id,
                type: ActivityType.note,
                body: `No-show marcado por ${actorLabel}`,
                payload: {
                  from: existingLead.status,
                  to: status,
                },
                createdBy: profileInfo.id,
              },
            });
          } catch (error) {
            console.warn("Não foi possível registrar atividade de no-show:", error);
          }
        }

        if (status === LeadStatus.future_sale) {
          try {
            await prisma.leadActivity.create({
              data: {
                leadId: id,
                type: ActivityType.note,
                body: `Contato futuro agendado por ${actorLabel}`,
                payload: {
                  followUpAt: lead.followUpAt ? lead.followUpAt.toISOString() : null,
                  followUpNotes: lead.followUpNotes || null,
                },
                createdBy: profileInfo.id,
              },
            });
          } catch (error) {
            console.warn("Não foi possível registrar atividade de venda futura:", error);
          }
        }

        if (status === LeadStatus.opportunityLost || status === LeadStatus.operator_denied) {
          try {
            await prisma.leadActivity.create({
              data: {
                leadId: id,
                type: ActivityType.note,
                body: `Motivo registrado por ${actorLabel}: ${lead.lossReason || "Não informado"}`,
                payload: {
                  status,
                  reason: lead.lossReason || null,
                  reasonDetails: lead.lossReasonDetails || null,
                },
                createdBy: profileInfo.id,
              },
            });
          } catch (error) {
            console.warn("Não foi possível registrar motivo do status:", error);
          }
        }

        if (existingLead.status) {
          await this.handleOfferSubmissionAlert({
            lead,
            previousStatus: existingLead.status,
            nextStatus: status,
            actorProfileId: profileInfo.id,
            actorName: actorLabel,
          }).catch((err) => console.error("[LeadUseCase][handleOfferSubmissionAlert] Background error:", err));
        }

        if (existingLead.status !== status && existingLead.teamId) {
          teamAutomationDispatcherService
            .dispatch({
              type: status === LeadStatus.no_show ? "meeting_no_show" : "status_changed",
              teamId: existingLead.teamId,
              leadId: id,
              data: {
                newStatus: status,
                statusEnteredAt: lead.statusEnteredAt?.toISOString(),
              },
            })
            .catch(console.error);
        }
      }

      const successMessages = ["Status do lead atualizado com sucesso"];
      if (transitionWarnings.length > 0) {
        successMessages.push("Aviso: evento no Google Calendar não foi removido.");
      }

      return new Output(
        true,
        successMessages,
        [],
        {
          ...this.transformToDTO(lead),
          transition: createTransition(true, "none", {
            warnings: transitionWarnings.length > 0 ? transitionWarnings : undefined,
          }),
        }
      );
    } catch (error) {
      console.error("Erro ao atualizar status do lead:", error);
      return new Output(
        false,
        [],
        ["Erro interno do servidor ao atualizar status do lead"],
        {
          transition: {
            allowed: false,
            blockerType: "validation_error",
            targetStatus: status,
          },
        }
      );
    }
  }

  async assignLeadToOperator(supabaseId: string, id: string, operatorId: string): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const existingLead = await this.leadRepository.findById(id);
      if (!existingLead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      const lead = await this.leadRepository.assignToOperator(id, operatorId);
      const leadWithRelations = lead as typeof lead & {
        assignee?: { fullName?: string | null; email?: string | null };
      };

      if (existingLead.assignedTo !== operatorId) {
        const assigneeLabel =
          leadWithRelations.assignee?.fullName ||
          leadWithRelations.assignee?.email ||
          "Responsável";
        try {
          await prisma.leadActivity.create({
            data: {
              leadId: id,
              type: ActivityType.note,
              body: `Lead atribuído para ${assigneeLabel}`,
              payload: {
                previousAssignedTo: existingLead.assignedTo ?? null,
                assignedTo: operatorId,
              },
              createdBy: profileInfo.id,
            },
          });
        } catch (error) {
          console.warn("Não foi possível registrar atividade de atribuição:", error);
        }

        this.enqueueLeadAssignedPush(
          { id: lead.id, leadCode: lead.leadCode ?? null, name: lead.name },
          operatorId,
        );
      }

      return new Output(true, ["Lead atribuído ao operador com sucesso"], [], this.transformToDTO(lead));
    } catch (error) {
      console.error("Erro ao atribuir lead ao operador:", error);
      return new Output(false, [], ["Erro interno do servidor ao atribuir lead ao operador"], null);
    }
  }

  async getLeadsByStatus(supabaseId: string, status: LeadStatus): Promise<Output> {
    try {
      // Buscar informações do perfil através do ProfileUseCase
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const managerId = isManagerLikeRole(profileInfo.role) ? profileInfo.id : profileInfo.managerId;
      
      if (!managerId) {
        return new Output(false, [], ["Manager não identificado"], null);
      }

      const leads = await this.leadRepository.getLeadsByStatus(managerId, status);
      return new Output(true, [], [], leads.map(lead => this.transformToDTO(lead)));
    } catch (error) {
      console.error("Erro ao buscar leads por status:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async transferLead(supabaseId: string, id: string, data: TransferLeadRequest): Promise<Output> {
    try {
      // Buscar informações do perfil do usuário atual
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      // Verificar se o usuário atual é um manager
      if (!isManagerLikeRole(profileInfo.role)) {
        return new Output(false, [], ["Apenas managers podem transferir leads"], null);
      }

      // Buscar o lead para verificar se pertence ao manager atual
      const lead = await this.leadRepository.findById(id);
      
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      // Verificar se o lead pertence ao manager atual
      if (lead.managerId !== profileInfo.id) {
        return new Output(false, [], ["Você só pode transferir leads que são seus"], null);
      }

      // Verificar se não é uma transferência para o mesmo manager
      if (data.newManagerId === profileInfo.id) {
        return new Output(false, [], ["Não é possível transferir o lead para você mesmo"], null);
      }

      // Realizar a transferência
      const transferredLead = await this.leadRepository.transferToManager(
        id, 
        data.newManagerId, 
        data.reason || undefined
      );

      return new Output(true, [], ["Lead transferido com sucesso"], this.transformToDTO(transferredLead));
    } catch (error) {
      console.error("Erro ao transferir lead:", error);
      return new Output(false, [], ["Erro interno do servidor"], null);
    }
  }

  async transferLeadBetweenTeams(
    supabaseId: string,
    callerTeamId: string,
    id: string,
    data: TransferLeadBetweenTeamsRequest
  ): Promise<Output> {
    try {
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      if (!profileInfo.isMaster) {
        const transferMembership = await prisma.teamMember.findUnique({
          where: {
            teamId_profileId: {
              teamId: callerTeamId,
              profileId: profileInfo.id,
            },
          },
          select: {
            role: true,
            canTransferAccountLeads: true,
          },
        });

        const canTransfer =
          (transferMembership?.role === "manager" || transferMembership?.role === "backoffice") &&
          transferMembership.canTransferAccountLeads === true;

        if (!canTransfer) {
          return new Output(false, [], ["Acesso negado: delegação de transferência de leads é obrigatória."], null);
        }
      }

      const lead = await this.leadRepository.findById(id);
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      if (lead.status !== "new_opportunity") {
        return new Output(false, [], ["O lead só pode ser transferido quando estiver com o status Nova Oportunidade"], null);
      }

      // P1: non-master managers can only transfer leads from their own team
      if (!profileInfo.isMaster && lead.teamId !== callerTeamId) {
        return new Output(false, [], ["Acesso negado: o lead não pertence ao seu time"], null);
      }

      const sourceTeam = lead.teamId
        ? await prisma.team.findUnique({ where: { id: lead.teamId }, select: { masterId: true } })
        : null;
      const masterProfileId = profileInfo.isMaster
        ? profileInfo.id
        : (sourceTeam?.masterId ?? null);

      if (!masterProfileId) {
        return new Output(false, [], ["Não foi possível identificar o master do time de origem"], null);
      }

      const targetTeam = await prisma.team.findUnique({
        where: { id: data.targetTeamId },
        select: { id: true, masterId: true },
      });
      if (!targetTeam || targetTeam.masterId !== masterProfileId) {
        return new Output(false, [], ["Time destino não encontrado ou não pertence ao mesmo master"], null);
      }

      if (data.targetTeamId === lead.teamId) {
        return new Output(false, [], ["O lead já pertence a este time"], null);
      }

      const transferRoute = lead.teamId
        ? await prisma.teamTransferRoute.findUnique({
            where: {
              sourceTeamId_targetTeamId: {
                sourceTeamId: lead.teamId,
                targetTeamId: data.targetTeamId,
              },
            },
            select: { id: true },
          })
        : null;

      if (!transferRoute) {
        return new Output(false, [], ["O time destino não está habilitado para receber transferências deste time"], null);
      }

      if (!data.closerId) {
        return new Output(false, [], ["Selecione um closer do time destino para concluir a transferência"], null);
      }

      const closerMember = await prisma.teamMember.findUnique({
        where: { teamId_profileId: { teamId: data.targetTeamId, profileId: data.closerId } },
        select: { functions: true },
      });
      if (!closerMember || !closerMember.functions.includes("CLOSER")) {
        return new Output(false, [], ["O closer selecionado não pertence ao time destino ou não possui função CLOSER"], null);
      }

      if (data.sdrId) {
        const sdrMember = await prisma.teamMember.findUnique({
          where: { teamId_profileId: { teamId: data.targetTeamId, profileId: data.sdrId } },
          select: { functions: true },
        });
        if (!sdrMember || !sdrMember.functions.includes("SDR")) {
          return new Output(false, [], ["O SDR selecionado não pertence ao time destino ou não possui função SDR"], null);
        }
      }

      let assigneeEmail: string | null = null;
      if (data.sdrId) {
        const sdrProfile = await prisma.profile.findUnique({
          where: { id: data.sdrId },
          select: { email: true },
        });
        assigneeEmail = sdrProfile?.email ?? null;
      }

      const existingPreSchedule = data.schedule
        ? await leadScheduleRepository.findLatestByLeadId(id)
        : null;

      let resolvedTransferSchedule: ResolvedTransferSchedule | null = null;

      if (data.schedule) {
        const scheduleResolution = resolveTransferScheduleInput(data.schedule, lead, existingPreSchedule);
        if (!scheduleResolution.ok) {
          return new Output(false, [], [scheduleResolution.error], null);
        }
        resolvedTransferSchedule = scheduleResolution.value;
      }

      const conflictResolution = await this.resolveTransferTeamUniqueConflicts(lead, data.targetTeamId);
      if (!conflictResolution.ok) {
        return conflictResolution.output;
      }

      const transferredLead = await this.leadRepository.transferToTeam(
        id,
        data.targetTeamId,
        data.closerId,
        data.sdrId ?? null,
        conflictResolution.sanitizations
      );

      const transferStateLead = await prisma.lead.update({
        where: { id: transferredLead.id },
        data: {
          isTransfer: false,
        },
        include: {
          manager: { select: { id: true, fullName: true, email: true } },
          assignee: { select: { id: true, fullName: true, email: true, profileIconUrl: true } },
          closer: { select: { id: true, fullName: true, email: true, profileIconUrl: true } },
          _count: { select: { attachments: true } },
        },
      });

      const deferredSchedule = resolvedTransferSchedule
        ? {
            leadId: transferredLead.id,
            leadName: transferredLead.name,
            leadEmail: transferredLead.email ?? null,
            leadStatus: transferredLead.status ?? LeadStatus.new_opportunity,
            leadManagerId: transferredLead.managerId,
            leadAssignedTo: transferredLead.assignedTo ?? null,
            leadAssigneeEmail: assigneeEmail,
            leadCurrentCloserId: null,
            leadCode: transferredLead.leadCode ?? null,
            closerId: data.closerId,
            teamId: data.targetTeamId,
            meetingDate: resolvedTransferSchedule.meetingDateIso,
            meetingTitle: resolvedTransferSchedule.meetingTitle,
            meetingNotes: resolvedTransferSchedule.meetingNotes,
            meetingLink: resolvedTransferSchedule.meetingLink,
            meetingType: resolvedTransferSchedule.meetingType,
            extraGuests: resolvedTransferSchedule.extraGuests,
            createdByProfileId: profileInfo.id,
            transitionStatusToScheduled: resolvedTransferSchedule.transitionStatusToScheduled,
          }
        : undefined;

      await prisma.leadTransfer.create({
        data: {
          leadId: transferredLead.id,
          fromTeamId: lead.teamId!,
          toTeamId: data.targetTeamId,
          transferredByProfileId: profileInfo.id,
          receivedByProfileId: data.closerId,
          fromManagerId: lead.managerId,
          toManagerId: transferredLead.managerId,
          transferTagUsed: lead.isTransfer === true,
          preScheduledAt: lead.meetingDate ?? null,
          scheduledAtTransfer: false,
        },
      });

      const finalLead = await this.leadRepository.findById(transferredLead.id);
      const result: TransferLeadBetweenTeamsResult = {
        lead: this.transformToDTO(finalLead ?? transferStateLead),
        ...(deferredSchedule
          ? {
              schedulePending: true,
              deferredSchedule,
              transferredByProfileId: profileInfo.id,
              sourceTeamId: lead.teamId!,
              targetTeamId: data.targetTeamId,
            }
          : {}),
      };

      return new Output(true, ["Lead transferido entre times com sucesso"], [], result);
    } catch (error) {
      console.error("[transferLeadBetweenTeams] Erro ao transferir lead entre times:", error);

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const isCnpjDup = Array.isArray(target) && target.includes("cnpj");
        const message = isCnpjDup
          ? "Já existe um lead com este CNPJ no time destino"
          : "Já existe um lead com este e-mail no time destino";
        return new Output(false, [], [message], null);
      }

      return new Output(false, [], ["Erro interno do servidor ao transferir lead entre times"], null);
    }
  }

  async runDeferredTransferScheduleAfterTransfer(
    leadId: string,
    transferResult: TransferLeadBetweenTeamsResult
  ): Promise<void> {
    const { deferredSchedule, transferredByProfileId, sourceTeamId, targetTeamId, lead } = transferResult;
    if (!deferredSchedule || !transferredByProfileId || !sourceTeamId || !targetTeamId) {
      return;
    }

    const notifyScheduleFailure = async (errorMessage: string) => {
      await prisma.leadActivity.create({
        data: {
          leadId,
          ...buildStudioActivityData({
            type: ActivityType.note,
            body: `Lead transferido, mas o agendamento falhou: ${errorMessage}`,
            payload: {
              kind: "schedule",
              action: "transfer_schedule_failed",
              error: errorMessage,
            },
          }),
        },
      });

      await notificationService.createTransferScheduleFailedNotification({
        teamId: targetTeamId,
        recipientProfileId: transferredByProfileId,
        leadId,
        leadCode: lead.leadCode ?? null,
        leadName: lead.name,
        errorMessage,
      });
    };

    try {
      const scheduleOutput = await leadScheduleService.createSchedule(deferredSchedule);

      if (scheduleOutput.isValid) {
        await prisma.leadTransfer.updateMany({
          where: { leadId, toTeamId: targetTeamId },
          data: { scheduledAtTransfer: true },
        });
        return;
      }

      const errorMessage =
        Array.isArray(scheduleOutput.errorMessages) && scheduleOutput.errorMessages.length > 0
          ? scheduleOutput.errorMessages[0]
          : "erro desconhecido";

      await notifyScheduleFailure(errorMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "erro interno ao agendar após transferência";
      console.error("[transferLeadBetweenTeams][deferredSchedule] Erro no agendamento pós-transferência:", error);

      try {
        await notifyScheduleFailure(errorMessage);
      } catch (notifyError) {
        console.error("[transferLeadBetweenTeams][deferredSchedule] Erro ao registrar falha de agendamento:", notifyError);
      }
    }
  }

  private formatLeadConflictLabel(conflict: { leadCode: string | null; name: string; id: string }): string {
    if (conflict.leadCode && conflict.name) {
      return `${conflict.leadCode} — ${conflict.name}`;
    }
    return conflict.leadCode ?? conflict.name ?? conflict.id;
  }

  private async resolveTransferTeamUniqueConflicts(
    lead: { id: string; email: string | null; cnpj: string | null },
    targetTeamId: string
  ): Promise<{ ok: true; sanitizations: TransferToTeamSanitization[] } | { ok: false; output: Output }> {
    const conflictFilters: Prisma.LeadWhereInput[] = [];
    if (lead.email) {
      conflictFilters.push({ email: { equals: lead.email, mode: "insensitive" } });
    }
    const normalizedCnpj = lead.cnpj?.trim();
    if (normalizedCnpj) {
      conflictFilters.push({ cnpj: normalizedCnpj });
    }

    if (!conflictFilters.length) {
      return { ok: true, sanitizations: [] };
    }

    const conflicts = await prisma.lead.findMany({
      where: {
        teamId: targetTeamId,
        NOT: { id: lead.id },
        OR: conflictFilters,
      },
      select: { id: true, email: true, cnpj: true, leadCode: true, name: true, status: true },
    });

    const sanitizationByLeadId = new Map<string, TransferToTeamSanitization>();

    for (const conflict of conflicts) {
      const emailMatches =
        !!lead.email &&
        !!conflict.email &&
        lead.email.toLowerCase() === conflict.email.toLowerCase();
      const cnpjMatches = !!normalizedCnpj && conflict.cnpj === normalizedCnpj;

      if (emailMatches) {
        if (!isLostStatus(conflict.status)) {
          return {
            ok: false,
            output: new Output(
              false,
              [],
              [
                `Já existe um lead com este e-mail no time destino (${this.formatLeadConflictLabel(conflict)})`,
              ],
              null
            ),
          };
        }

        const existing = sanitizationByLeadId.get(conflict.id) ?? {
          leadId: conflict.id,
          clearEmail: false,
          clearCnpj: false,
        };
        existing.clearEmail = true;
        sanitizationByLeadId.set(conflict.id, existing);
      }

      if (cnpjMatches) {
        if (!isLostStatus(conflict.status)) {
          return {
            ok: false,
            output: new Output(
              false,
              [],
              [
                `Já existe um lead com este CNPJ no time destino (${this.formatLeadConflictLabel(conflict)})`,
              ],
              null
            ),
          };
        }

        const existing = sanitizationByLeadId.get(conflict.id) ?? {
          leadId: conflict.id,
          clearEmail: false,
          clearCnpj: false,
        };
        existing.clearCnpj = true;
        sanitizationByLeadId.set(conflict.id, existing);
      }
    }

    return { ok: true, sanitizations: [...sanitizationByLeadId.values()] };
  }

  private async validateLeadCustomFieldsInput(
    teamId: string,
    customFields: Record<string, unknown>
  ): Promise<Output | null> {
    const definitions = await leadCustomFieldRepository.listActiveByTeamId(teamId);
    const validation = validateLeadCustomFieldsPayload(
      definitions.map(mapLeadCustomFieldDefinitionToDTO),
      customFields,
      true
    );
    if (!validation.success) {
      return new Output(false, [], validation.errors, null);
    }
    return null;
  }

  private async buildCustomFieldUpsertEntries(
    teamId: string,
    customFields: Record<string, unknown>
  ) {
    const definitions = await leadCustomFieldRepository.listActiveByTeamId(teamId);
    const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    return Object.entries(customFields)
      .filter(([key]) => definitionByKey.has(key))
      .map(([key, value]) => ({
        definitionId: definitionByKey.get(key)!.id,
        value: value as never,
      }));
  }

  private async attachCustomFieldsToDto(leadId: string, dto: LeadResponseDTO): Promise<LeadResponseDTO> {
    const customFields = await leadCustomFieldService.getLeadCustomFieldValues(leadId);
    if (customFields.length === 0) {
      return dto;
    }
    return { ...dto, customFields };
  }

  private transformToDTO(lead: any, viewerProfileId?: string | null): LeadResponseDTO {
    return {
      id: lead.id,
      leadCode: lead.leadCode,
      managerId: lead.managerId,
      teamId: lead.teamId ?? null,
      assignedTo: lead.assignedTo,
      status: lead.status,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      cnpj: lead.cnpj,
      razaoSocial: lead.razaoSocial ?? null,
      age: lead.age,
      currentHealthPlan: lead.currentHealthPlan,
      currentValue: lead.currentValue ? Number(lead.currentValue) : null,
      referenceHospital: lead.referenceHospital,
      currentTreatment: lead.currentTreatment,
      meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
      meetingTitle: lead.meetingTitle,
      meetingNotes: lead.meetingNotes,
      meetingLink: lead.meetingLink,
      meetingHeald: lead.meetingHeald,
      meetingPresenceConfirmed: lead.meetingPresenceConfirmed === true,
      meetingPresenceConfirmedAt: lead.meetingPresenceConfirmedAt
        ? lead.meetingPresenceConfirmedAt.toISOString()
        : null,
      isTransfer: lead.isTransfer === true,
      followUpAt: lead.followUpAt ? lead.followUpAt.toISOString() : null,
      followUpNotes: lead.followUpNotes ?? null,
      followUpSourceStatus: lead.followUpSourceStatus ?? null,
      lossReason: lead.lossReason ?? null,
      lossReasonDetails: lead.lossReasonDetails ?? null,
      statusEnteredAt: lead.statusEnteredAt ? lead.statusEnteredAt.toISOString() : null,
      closerId: lead.closerId ?? null,
      notes: lead.notes,
      createdBy: lead.createdBy,
      updatedBy: lead.updatedBy,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      // Novos campos de venda
      ticket: lead.ticket ? Number(lead.ticket) : null,
      contractDueDate: lead.contractDueDate ? lead.contractDueDate.toISOString() : null,
      soldPlan: lead.soldPlan,
      // Meeting type & referral fields
      meetingType: lead.meetingType ?? null,
      isReferral: lead.isReferral ?? null,
      referrerLeadId: lead.referrerLeadId ?? null,
      referrerName: lead.referrerName ?? null,
      referrerPhone: lead.referrerPhone ?? null,
      leadTimeDueAt: lead.leadTimeDueAt ?? null,
      isLeadTimeBreached: lead.isLeadTimeBreached ?? false,
      attachmentCount: lead._count?.attachments || lead.attachments?.length || 0,
      proposalReviewStatus: lead.proposalReview?.status ?? null,
      ...(lead.manager && {
        manager: {
          id: lead.manager.id,
          fullName: lead.manager.fullName,
          email: lead.manager.email,
        }
      }),
      ...(lead.assignee && {
        assignee: {
          id: lead.assignee.id,
          fullName: lead.assignee.fullName,
          email: lead.assignee.email,
          avatarUrl: lead.assignee.profileIconUrl || null,
        }
      }),
      ...(lead.closer && {
        closer: {
          id: lead.closer.id,
          fullName: lead.closer.fullName,
          email: lead.closer.email,
          avatarUrl: lead.closer.profileIconUrl || null,
        }
      }),
      ...(lead.activities && {
        activities: lead.activities.map((activity: any) => ({
          id: activity.id,
          type: activity.type,
          body: activity.body,
          payload: activity.payload,
          createdAt: activity.createdAt.toISOString(),
          reactions: this.aggregateActivityReactions(activity.reactions, viewerProfileId),
          ...((activity.author
            ? {
                author: {
                  id: activity.author.id,
                  fullName: activity.author.fullName,
                  email: activity.author.email,
                  avatarUrl: activity.author.profileIconUrl || null,
                },
              }
            : activity.payload?.displayAuthor
              ? {
                  author: {
                    id: "corretor-studio",
                    fullName: String(activity.payload.displayAuthor),
                    email: "",
                    avatarUrl: activity.payload.authorAvatarUrl ?? "/corretor-studio-icon.svg",
                  },
                }
              : {}) as Record<string, unknown>)
        }))
      })
    };
  }

  private aggregateActivityReactions(
    reactions: Array<{ emoji: string; emojiUnified: string; profileId: string }> | undefined,
    viewerProfileId?: string | null
  ) {
    if (!reactions || reactions.length === 0) {
      return [];
    }

    const includeViewer = !!viewerProfileId;
    const map = new Map<string, { emoji: string; unified: string; count: number; reactedByMe?: boolean }>();

    reactions.forEach((reaction) => {
      const unified = reaction.emojiUnified;
      const existing = map.get(unified) || {
        emoji: reaction.emoji,
        unified,
        count: 0,
        reactedByMe: includeViewer ? false : undefined,
      };

      existing.count += 1;
      if (includeViewer && reaction.profileId === viewerProfileId) {
        existing.reactedByMe = true;
      }

      map.set(unified, existing);
    });

    return Array.from(map.values());
  }

  private normalizeEmail(value?: string | null): string | null {
    const normalized = value?.trim().toLowerCase() || "";
    return normalized.length > 0 ? normalized : null;
  }

  private resolveProposalAlertEmails(
    toCandidates: Array<string | null | undefined>,
    ccCandidates: Array<string | null | undefined>,
    leadEmail?: string | null
  ) {
    const blockedLeadEmail = this.normalizeEmail(leadEmail);
    const seen = new Set<string>();

    const normalizeAndCollect = (emails: Array<string | null | undefined>) => {
      const result: string[] = [];
      for (const candidate of emails) {
        const normalized = this.normalizeEmail(candidate);
        if (!normalized) continue;
        if (blockedLeadEmail && normalized === blockedLeadEmail) continue;
        if (seen.has(normalized)) continue;

        seen.add(normalized);
        result.push(normalized);
      }
      return result;
    };

    const to = normalizeAndCollect(toCandidates);
    const cc = normalizeAndCollect(ccCandidates);

    // Resend exige pelo menos um destinatario em `to`; CC sozinho nao envia.
    if (to.length === 0 && cc.length > 0) {
      return { to: cc, cc: [] };
    }

    return { to, cc };
  }

  private async handleOfferSubmissionAlert(input: {
    lead: any;
    previousStatus: LeadStatus;
    nextStatus: LeadStatus;
    actorProfileId: string;
    actorName: string;
  }) {
    if (
      input.nextStatus !== LeadStatus.offerSubmission
      || input.previousStatus === LeadStatus.offerSubmission
    ) {
      return;
    }

    const leadId = input.lead.id as string;
    await associateProposalUseCase.resetReviewOnResubmit(leadId).catch((err) =>
      console.error("[LeadUseCase][resetReviewOnResubmit]", err)
    );

    const teamId = input.lead.teamId as string | null;
    if (!teamId) {
      return;
    }

    try {
      const [team, backofficeMembers, closerProfile] = await Promise.all([
        prisma.team.findUnique({
          where: { id: teamId },
          select: {
            masterId: true,
            master: { select: { sponsorMasterId: true } },
          },
        }),
        prisma.teamMember.findMany({
          where: {
            teamId,
            role: "backoffice",
          },
          select: {
            profileId: true,
            profile: {
              select: {
                email: true,
                fullName: true,
              },
            },
          },
        }),
        input.lead.closerId
          ? prisma.profile.findUnique({
              where: { id: input.lead.closerId as string },
              select: { id: true, email: true, fullName: true },
            })
          : Promise.resolve(null),
      ]);

      if (!team?.masterId) {
        return;
      }

      if (team.master?.sponsorMasterId) {
        await associateProposalUseCase.notifyAssociateOfferSubmission({
          leadId,
          teamId,
          leadCode: input.lead.leadCode,
          leadName: input.lead.name,
          actorProfileId: input.actorProfileId,
          actorName: input.actorName,
        }).catch((err) => console.error("[LeadUseCase][notifyAssociateOfferSubmission]", err));
      }

      const masterProfile = await prisma.profile.findUnique({
        where: { id: team.masterId },
        select: { id: true, email: true, fullName: true },
      });

      const isAssociateAccount = Boolean(team.master?.sponsorMasterId);

      const emailRecipients = isAssociateAccount
        ? { to: [] as string[], cc: [] as string[] }
        : this.resolveProposalAlertEmails(
            [
              ...backofficeMembers.map((member) => member.profile.email),
              closerProfile?.email,
            ],
            [masterProfile?.email],
            input.lead.email
          );

      const sdrName = input.lead.assignee?.fullName || input.lead.assignee?.email || "Nao informado";
      const closerName = input.lead.closer?.fullName || input.lead.closer?.email || "Nao informado";
      const leadAttachments = isAssociateAccount
        ? []
        : await this.buildLeadProposalAttachments(input.lead.id);

      if (!isAssociateAccount && (emailRecipients.to.length > 0 || emailRecipients.cc.length > 0)) {
        try {
          const emailService = getEmailService();
          const emailResult = await emailService.sendLeadProposalPendingUrgentEmail({
            to: emailRecipients.to,
            cc: emailRecipients.cc,
            attachments: leadAttachments,
            teamId,
            leadCode: input.lead.leadCode,
            leadName: input.lead.name,
            leadEmail: input.lead.email,
            leadPhone: input.lead.phone,
            sdrName,
            closerName,
            notes: input.lead.notes,
            actorName: input.actorName,
          });
          if (!emailResult?.success) {
            console.error(
              "[LeadUseCase][handleOfferSubmissionAlert] Falha ao enviar e-mail de proposta pendente:",
              emailResult?.error
            );
          }
        } catch (emailError) {
          console.error("Erro ao enviar e-mail de proposta pendente:", emailError);
        }
      }

      const notificationRecipients = Array.from(
        new Set(
          [
            ...backofficeMembers.map((member) => member.profileId),
            closerProfile?.id,
            masterProfile?.id,
          ].filter((profileId): profileId is string => Boolean(profileId))
        )
      );

      if (notificationRecipients.length > 0) {
        try {
          await notificationService.createLeadProposalPendingNotification({
            teamId,
            actorProfileId: input.actorProfileId,
            actorName: input.actorName,
            recipientProfileIds: notificationRecipients,
            leadId: input.lead.id,
            leadCode: input.lead.leadCode,
            leadName: input.lead.name,
            leadEmail: input.lead.email,
            leadPhone: input.lead.phone,
            sdrName,
            closerName,
            notes: input.lead.notes,
            previousStatus: input.previousStatus,
            nextStatus: input.nextStatus,
          });
        } catch (notificationError) {
          console.error("Erro ao criar notificação interna de proposta pendente:", notificationError);
        }
      }
    } catch (error) {
      console.error("Erro ao processar alerta de proposta pendente:", error);
    }
  }

  private async ensureTransferPreSchedule(lead: any): Promise<void> {
    if (!lead?.id || !lead?.meetingDate) return;

    const meetingDate = lead.meetingDate instanceof Date ? lead.meetingDate : new Date(lead.meetingDate);
    if (Number.isNaN(meetingDate.getTime())) return;

    await prisma.leadsSchedule.upsert({
      where: { leadId: lead.id },
      create: {
        leadId: lead.id,
        date: meetingDate,
        meetingTitle: lead.meetingTitle || `Estudo Plano de Saúde: ${lead.name}`,
        notes: lead.meetingNotes || lead.notes || null,
        meetingLink: null,
        meetingType: lead.meetingType || "online",
        extraGuests: [],
        publicShareTokenHash: null,
        publicShareExpiresAt: null,
      },
      update: {
        date: meetingDate,
        meetingTitle: lead.meetingTitle || `Estudo Plano de Saúde: ${lead.name}`,
        notes: lead.meetingNotes || lead.notes || null,
        meetingLink: null,
        meetingType: lead.meetingType || "online",
        publicShareTokenHash: null,
        publicShareExpiresAt: null,
      },
    });
  }

  async enrichLeadRazaoSocial(leadId: string, cnpj: string): Promise<void> {
    try {
      const razaoSocial = await cnpjLookupService.lookupRazaoSocial(cnpj);
      if (!razaoSocial) {
        console.warn(
          "[LeadUseCase][enrichLeadRazaoSocial] Razão social não resolvida em background",
          { leadId }
        );
        return;
      }

      await this.leadRepository.update(leadId, { razaoSocial });
      console.info(
        "[LeadUseCase][enrichLeadRazaoSocial] Razão social atualizada em background",
        { leadId }
      );
    } catch (error) {
      console.error("[LeadUseCase][enrichLeadRazaoSocial] Background error:", error);
    }
  }

  private async resolveTransferScheduleShareUrl(lead: any, teamId: string): Promise<string | null> {
    void teamId;
    void lead;

    return null;
  }

  private enqueueLeadAssignedPush(
    lead: { id: string; leadCode: string | null; name: string },
    assigneeProfileId: string | null | undefined,
  ): void {
    if (!assigneeProfileId) return;

    void studioBotOutboxService
      .enqueueLeadAssigned({
        profileId: assigneeProfileId,
        leadId: lead.id,
        leadCode: lead.leadCode,
        leadName: lead.name,
      })
      .catch((error) => {
        console.error("[LeadUseCase][enqueueLeadAssignedPush]", error);
      });
  }

  private async handleTransferActivationAlert(lead: any): Promise<void> {
    const teamId = lead.teamId as string | null;
    if (!teamId) return;

    try {
      const [team, eligibleMembers] = await Promise.all([
        prisma.team.findUnique({
          where: { id: teamId },
          select: { masterId: true },
        }),
        prisma.teamMember.findMany({
          where: {
            teamId,
            role: { in: ["manager", "backoffice"] },
            canTransferAccountLeads: true,
          },
          select: {
            profileId: true,
            profile: { select: { email: true } },
          },
        }),
      ]);

      if (!team) return;

      const masterProfile = team.masterId
        ? await prisma.profile.findUnique({
            where: { id: team.masterId },
            select: { id: true, email: true },
          })
        : null;

      const recipientIds = Array.from(
        new Set([
          ...eligibleMembers.map((m) => m.profileId),
          ...(masterProfile?.id ? [masterProfile.id] : []),
        ])
      );

      const emailAddresses = [
        ...eligibleMembers.map((m) => m.profile.email).filter((e): e is string => Boolean(e)),
        ...(masterProfile?.email ? [masterProfile.email] : []),
      ];
      const uniqueEmails = Array.from(new Set(emailAddresses));
      const scheduleShareUrl = await this.resolveTransferScheduleShareUrl(lead, teamId);
      const sdrName =
        lead.assignee?.fullName || lead.assignee?.email || "Não informado";

      await Promise.all([
        uniqueEmails.length > 0
          ? getEmailService()
              .sendLeadTransferActivatedEmail({
                to: uniqueEmails,
                teamId,
                leadCode: lead.leadCode,
                leadName: lead.name,
                leadPhone: lead.phone,
                leadCnpj: lead.cnpj,
                leadCurrentHealthPlan: lead.currentHealthPlan,
                leadCurrentValue: lead.currentValue,
                leadNotes: lead.notes,
                sdrName,
                scheduleShareUrl,
              })
              .catch((err) => console.error("[handleTransferActivationAlert] E-mail error:", err))
          : Promise.resolve(),
        recipientIds.length > 0
          ? notificationService
              .createLeadTransferActivatedNotification({
                teamId,
                recipientProfileIds: recipientIds,
                leadId: lead.id,
                leadCode: lead.leadCode,
                leadName: lead.name,
                sdrName,
                scheduleShareUrl,
              })
              .catch((err) => console.error("[handleTransferActivationAlert] Notification error:", err))
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("[handleTransferActivationAlert] Erro:", error);
    }
  }

  private async buildLeadProposalAttachments(leadId: string): Promise<Attachment[]> {
    const leadAttachments = await prisma.leadAttachment.findMany({
      where: { leadId },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        storagePath: true,
        fileUrl: true,
      },
      orderBy: { uploadedAt: "asc" },
    });

    if (leadAttachments.length === 0) {
      return [];
    }

    const supabaseAdmin = createSupabaseAdmin();

    const downloads = await Promise.all(
      leadAttachments.map(async (leadAttachment) => {
        try {
          let buffer: Buffer | null = null;

          const storagePath = leadAttachment.storagePath?.trim();
          if (supabaseAdmin && storagePath) {
            const { data, error } = await supabaseAdmin.storage
              .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
              .download(storagePath);

            if (error) {
              console.error("Erro ao baixar anexo do storage para e-mail:", {
                leadId,
                attachmentId: leadAttachment.id,
                storagePath,
                error,
              });
            } else if (data) {
              buffer = Buffer.from(await data.arrayBuffer());
            }
          }

          if (!buffer && leadAttachment.fileUrl) {
            const response = await fetch(leadAttachment.fileUrl);
            if (!response.ok) {
              throw new Error(`Falha ao baixar arquivo via URL pública: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }

          if (!buffer) return null;

          return {
            filename: leadAttachment.fileName || `documento-${leadAttachment.id}`,
            content: buffer,
            ...(leadAttachment.fileType ? { contentType: leadAttachment.fileType } : {}),
          } as Attachment;
        } catch (error) {
          console.error("Erro ao preparar anexo de lead para e-mail:", {
            leadId,
            attachmentId: leadAttachment.id,
            error,
          });
          return null;
        }
      })
    );

    return downloads.filter((a): a is Attachment => a !== null);
  }
}
