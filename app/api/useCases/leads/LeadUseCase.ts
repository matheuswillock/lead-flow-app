import { ILeadUseCase } from "./ILeadUseCase";
import type {
  LeadCreateOptions,
  LeadCreationActivityContext,
  UpdateLeadStatusTriggerInput,
} from "./ILeadUseCase";
import { ILeadRepository } from "../../infra/data/repositories/lead/ILeadRepository";
import { IProfileUseCase } from "../profiles/IProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus, ActivityType, InviteDispatchStatus, Prisma, TeamStatusRuleType } from "@prisma/client";
import { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "../../v1/leads/DTO/requestToUpdateLead";
import { TransferLeadRequest } from "../../v1/leads/DTO/requestToTransferLead";
import { LeadResponseDTO } from "../../v1/leads/DTO/leadResponseDTO";
import { leadFinalizedRepository } from "../../infra/data/repositories/leadFinalized/LeadFinalizedRepository";
import { leadScheduleRepository } from "../../infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { healthPlanService } from "../../services/healthPlans/HealthPlanService";
import { leadScheduleService } from "../../services/leadSchedule/LeadScheduleService";
import { prisma } from "../../infra/data/prisma";
import { MAX_DECIMAL_LABEL, MAX_DECIMAL_VALUE } from "../../v1/leads/DTO/leadValueLimits";
import { normalizeHealthPlanName } from "@/lib/healthPlans";
import { getEmailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { isManagerLikeRole } from "@/lib/roles";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { Attachment } from "resend";
import { teamStatusRuleService } from "@/app/api/services/teamStatusRule/TeamStatusRuleService";

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
const SCHEDULED_INVITE_SUCCESS_STATUSES: InviteDispatchStatus[] = ["sent_google", "sent_resend"];

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

    const hasMeetingData = !!(data.closerId && data.meetingDate);
    if (!hasMeetingData || !teamId) {
      return leadOutput;
    }

    try {
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      if (!profileInfo) {
        return leadOutput;
      }

      const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
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
    const output = await this.createLeadInternal(supabaseId, data, true, teamId);

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

      // O managerId do lead deve sempre apontar para o master
      const managerId = profileInfo.isMaster ? profileInfo.id : profileInfo.managerId;
      
      if (!managerId) {
        return new Output(false, [], ["Master não identificado"], null);
      }

      // Se for operator e não foi definido assignedTo, atribuir automaticamente ao próprio operator
      let assignedTo = skipAutoAssign ? undefined : data.assignedTo;
      if (!skipAutoAssign && profileInfo.role === 'operator' && !assignedTo) {
        assignedTo = profileInfo.id;
      }

      const leadCode = await this.generateLeadCode(data.name);

      if (!teamId) {
        return new Output(false, [], ["Team ID é obrigatório para criar lead"], null);
      }

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

      const lead = await this.leadRepository.create({
        manager: { connect: { id: managerId } },
        team: { connect: { id: teamId } },
        leadCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        cnpj: data.cnpj || null,
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
        status: data.status || LeadStatus.new_opportunity,
        // Novos campos de venda (sempre null na criação)
        ticket: data.ticket || null,
        contractDueDate: data.contractDueDate ? new Date(data.contractDueDate) : null,
        soldPlan: normalizedPlans.soldPlan,
        creator: { connect: { id: profileInfo.id } },
        updater: { connect: { id: profileInfo.id } },
        ...(assignedTo && {
          assignee: { connect: { id: assignedTo } }
        }),
        ...(data.closerId && {
          closer: { connect: { id: data.closerId } }
        }),
        activities: {
          create: {
            type: ActivityType.note,
            body: creationActivityContext?.body || "Lead criado no sistema",
            payload:
              creationActivityContext?.payload === null
                ? Prisma.JsonNull
                : (creationActivityContext?.payload ?? undefined),
            author: { connect: { id: profileInfo.id } }
          }
        }
      });

      return new Output(true, ["Lead criado com sucesso"], [], this.transformToDTO(lead));
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

  async getLeadById(supabaseId: string, id: string): Promise<Output> {
    try {
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      const lead = await this.leadRepository.findById(id);
      
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      return new Output(true, [], [], this.transformToDTO(lead, profileInfo.id));
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

  async getAllLeadsByUserRole(
    supabaseId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
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
        });

        leads = result.leads;
      } else if (teamRole === 'operator') {
        const result = await this.leadRepository.findAllByOperatorIdInTeam(profileInfo.id, teamId, {
          status: options.status,
          assignedTo: options.assignedTo,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
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
      const shouldTrackCloser = data.closerId !== undefined;
      const shouldTrackMeetingHeald = data.meetingHeald !== undefined;
      const shouldTrackStatus = data.status !== undefined;
      const shouldTrackChanges = shouldTrackAssignment || shouldTrackCloser || shouldTrackMeetingHeald || shouldTrackStatus;
      const existingLead = shouldTrackChanges ? await this.leadRepository.findById(id) : null;
      if (shouldTrackChanges && !existingLead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      const updateData: any = {};
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
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj || null;
      if (data.age !== undefined) updateData.age = data.age;
      if (data.currentHealthPlan !== undefined) updateData.currentHealthPlan = normalizedPlans?.currentHealthPlan || null;
      if (data.currentValue !== undefined) updateData.currentValue = data.currentValue;
      if (data.referenceHospital !== undefined) updateData.referenceHospital = data.referenceHospital || null;
      if (data.currentTreatment !== undefined) updateData.currentTreatment = data.currentTreatment || null;
      if (data.meetingDate !== undefined) updateData.meetingDate = data.meetingDate ? new Date(data.meetingDate) : null;
      if (data.meetingTitle !== undefined) updateData.meetingTitle = data.meetingTitle || null;
      if (data.meetingNotes !== undefined) updateData.meetingNotes = data.meetingNotes || null;
      if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
      if (data.meetingHeald !== undefined) updateData.meetingHeald = data.meetingHeald || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined) updateData.status = data.status;
      // Novos campos de venda
      if (data.ticket !== undefined) updateData.ticket = data.ticket;
      if (data.contractDueDate !== undefined) updateData.contractDueDate = data.contractDueDate ? new Date(data.contractDueDate) : null;
      if (data.soldPlan !== undefined) updateData.soldPlan = normalizedPlans?.soldPlan || null;
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
      }

      if (shouldTrackCloser && existingLead?.closerId !== data.closerId) {
        const closerLabel = data.closerId
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
                closerId: data.closerId ?? null,
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

      if (shouldTrackStatus && existingLead && existingLead.status !== lead.status) {
        await this.handleOfferSubmissionAlert({
          lead,
          previousStatus: existingLead.status,
          nextStatus: lead.status,
          actorProfileId: profileInfo.id,
          actorName: actorLabel,
        });
      }

      return new Output(true, ["Lead atualizado com sucesso"], [], this.transformToDTO(lead));
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
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      // Verificar permissões para operators
      if (profileInfo.role === 'operator') {
        const existingLead = await this.leadRepository.findById(id);
        
        if (!existingLead) {
          return new Output(false, [], ["Lead não encontrado"], null);
        }
        
        // Operator só pode deletar se criou o lead
        if (existingLead.createdBy !== profileInfo.id) {
          return new Output(false, [], ["Você só pode deletar leads que você criou"], null);
        }
      }

      await this.leadRepository.delete(id);
      return new Output(true, ["Lead excluído com sucesso"], [], null);
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      return new Output(false, [], ["Erro interno do servidor ao excluir lead"], null);
    }
  }

  async updateLeadStatus(
    supabaseId: string,
    id: string,
    status: LeadStatus,
    trigger?: UpdateLeadStatusTriggerInput
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

      const statusUpdateExtraData: Prisma.LeadUpdateInput = {};

      if (status === LeadStatus.no_show) {
        if (!existingLead.meetingDate) {
          return new Output(false, [], ["Lead precisa ter um agendamento para marcar no-show."], null);
        }
        if (existingLead.meetingDate.getTime() > Date.now()) {
          return new Output(false, [], ["Não é possível marcar no-show antes do horário agendado."], null);
        }
      }

      const isLeavingScheduled =
        existingLead.status === LeadStatus.scheduled &&
        status !== LeadStatus.scheduled &&
        status !== LeadStatus.no_show;

      if (isLeavingScheduled && existingLead.meetingHeald !== "yes") {
        const team = existingLead.teamId
          ? await prisma.team.findUnique({
              where: { id: existingLead.teamId },
              select: { masterId: true },
            })
          : null;
        const isTeamMaster = !!(team && team.masterId === profileInfo.id);
        const isAssignedCloser = !!existingLead.closerId && existingLead.closerId === profileInfo.id;
        const canConfirmMeetingHeald = isTeamMaster || isAssignedCloser;

        const allowNoShow =
          !!existingLead.meetingDate && existingLead.meetingDate.getTime() <= Date.now();

        const wantsMarkMeetingHeald = trigger?.meetingHeald === "yes";
        if (!wantsMarkMeetingHeald) {
          return new Output(
            false,
            [],
            ["Reunião não marcada como realizada. Somente o master ou o closer do lead pode confirmar."],
            {
              requiresMeetingHeald: true,
              canConfirmMeetingHeald,
              allowNoShow,
              meetingDate: existingLead.meetingDate ? existingLead.meetingDate.toISOString() : null,
            }
          );
        }

        if (!canConfirmMeetingHeald) {
          return new Output(
            false,
            [],
            ["Acesso negado: somente o master ou o closer do lead pode marcar a reunião como realizada."],
            {
              requiresMeetingHeald: true,
              canConfirmMeetingHeald: false,
              allowNoShow,
              meetingDate: existingLead.meetingDate ? existingLead.meetingDate.toISOString() : null,
            }
          );
        }

        statusUpdateExtraData.meetingHeald = "yes";
      }

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
          null
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
              });
            }

            return new Output(false, [], [ruleToSurface.confirmationMessage || defaultBlockingMessage], {
              requiresConfirmation: false,
              targetStatus: status,
              requiredStatus: ruleToSurface.requiredStatus,
            });
          }
        }
      }

      if (status === LeadStatus.scheduled) {
        const latestSchedule = await leadScheduleRepository.findLatestByLeadId(id);
        const resolvedMeetingLink = latestSchedule?.meetingLink?.trim() || existingLead.meetingLink?.trim() || "";
        const inviteDispatchSuccessful = latestSchedule?.inviteDispatchStatus
          ? SCHEDULED_INVITE_SUCCESS_STATUSES.includes(latestSchedule.inviteDispatchStatus)
          : false;

        if (
          !existingLead.meetingDate ||
          !existingLead.closerId ||
          !resolvedMeetingLink ||
          !inviteDispatchSuccessful
        ) {
          return new Output(
            false,
            [],
            ["Lead precisa de um agendamento válido antes de mudar para Agendado. Use o fluxo de agendamento."],
            null
          );
        }
      }

      if (status !== existingLead.status) {
        statusUpdateExtraData.statusEnteredAt = new Date();
      }

      if (status === LeadStatus.future_sale) {
        const followUpAt = trigger?.followUpAt ? new Date(trigger.followUpAt) : null;
        if (!followUpAt || Number.isNaN(followUpAt.getTime())) {
          return new Output(
            false,
            [],
            ["Venda Futura exige data válida para entrar em contato."],
            null
          );
        }

        statusUpdateExtraData.followUpAt = followUpAt;
        statusUpdateExtraData.followUpNotes = trigger?.followUpNotes?.trim() || null;
        statusUpdateExtraData.followUpSourceStatus = existingLead.status;
      }

      if (status === LeadStatus.opportunityLost || status === LeadStatus.operator_denied) {
        const reason = trigger?.reason?.trim() || "";
        if (!reason) {
          return new Output(
            false,
            [],
            ["Informe o motivo para concluir a mudança de status."],
            null
          );
        }

        statusUpdateExtraData.lossReason = reason;
        statusUpdateExtraData.lossReasonDetails = trigger?.reasonDetails?.trim() || null;
      }

      // Atualizar o status do lead
      const lead = await this.leadRepository.updateStatus(id, status, statusUpdateExtraData);

      // Se o status for contract_finalized, criar registro na tabela LeadFinalized
      if (status === LeadStatus.contract_finalized) {
        const createdAt = new Date(existingLead.createdAt);
        const finalizedAt = new Date();
        const durationInDays = Math.floor(
          (finalizedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        await leadFinalizedRepository.create({
          leadId: id,
          finalizedAt: finalizedAt,
          startDateAt: finalizedAt,
          duration: durationInDays,
          amount: Number(existingLead.currentValue || 0),
          notes: `Venda finalizada. Valor: R$ ${existingLead.currentValue || 0}`,
        });
      }

      if (existingLead.status !== status) {
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

        await this.handleOfferSubmissionAlert({
          lead,
          previousStatus: existingLead.status,
          nextStatus: status,
          actorProfileId: profileInfo.id,
          actorName: actorLabel,
        });
      }

      return new Output(true, ["Status do lead atualizado com sucesso"], [], this.transformToDTO(lead));
    } catch (error) {
      console.error("Erro ao atualizar status do lead:", error);
      return new Output(false, [], ["Erro interno do servidor ao atualizar status do lead"], null);
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
      leadTimeDueAt: lead.leadTimeDueAt ?? null,
      isLeadTimeBreached: lead.isLeadTimeBreached ?? false,
      attachmentCount: lead._count?.attachments || lead.attachments?.length || 0,
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
          ...(activity.author && {
            author: {
              id: activity.author.id,
              fullName: activity.author.fullName,
              email: activity.author.email,
              avatarUrl: activity.author.profileIconUrl || null,
            }
          })
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

    const teamId = input.lead.teamId as string | null;
    if (!teamId) {
      return;
    }

    try {
      const [team, backofficeMembers, closerProfile] = await Promise.all([
        prisma.team.findUnique({
          where: { id: teamId },
          select: { masterId: true },
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

      const masterProfile = await prisma.profile.findUnique({
        where: { id: team.masterId },
        select: { id: true, email: true, fullName: true },
      });

      const emailRecipients = this.resolveProposalAlertEmails(
        [
          ...backofficeMembers.map((member) => member.profile.email),
          closerProfile?.email,
        ],
        [masterProfile?.email],
        input.lead.email
      );

      const sdrName = input.lead.assignee?.fullName || input.lead.assignee?.email || "Nao informado";
      const closerName = input.lead.closer?.fullName || input.lead.closer?.email || "Nao informado";
      const leadAttachments = await this.buildLeadProposalAttachments(input.lead.id);

      if (emailRecipients.to.length > 0 || emailRecipients.cc.length > 0) {
        try {
          const emailService = getEmailService();
          await emailService.sendLeadProposalPendingUrgentEmail({
            to: emailRecipients.to,
            cc: emailRecipients.cc,
            attachments: leadAttachments,
            leadCode: input.lead.leadCode,
            leadName: input.lead.name,
            leadEmail: input.lead.email,
            leadPhone: input.lead.phone,
            sdrName,
            closerName,
            notes: input.lead.notes,
            actorName: input.actorName,
          });
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
    const attachments: Attachment[] = [];

    for (const leadAttachment of leadAttachments) {
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

        if (!buffer) {
          continue;
        }

        attachments.push({
          filename: leadAttachment.fileName || `documento-${leadAttachment.id}`,
          content: buffer,
          ...(leadAttachment.fileType ? { contentType: leadAttachment.fileType } : {}),
        });
      } catch (error) {
        console.error("Erro ao preparar anexo de lead para e-mail:", {
          leadId,
          attachmentId: leadAttachment.id,
          error,
        });
      }
    }

    return attachments;
  }
}
