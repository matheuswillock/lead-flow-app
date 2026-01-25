import { ILeadUseCase } from "./ILeadUseCase";
import { ILeadRepository } from "../../infra/data/repositories/lead/ILeadRepository";
import { IProfileUseCase } from "../profiles/IProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus, ActivityType } from "@prisma/client";
import { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "../../v1/leads/DTO/requestToUpdateLead";
import { TransferLeadRequest } from "../../v1/leads/DTO/requestToTransferLead";
import { LeadResponseDTO } from "../../v1/leads/DTO/leadResponseDTO";
import { leadFinalizedRepository } from "../../infra/data/repositories/leadFinalized/LeadFinalizedRepository";
import { leadScheduleRepository } from "../../infra/data/repositories/leadSchedule/LeadScheduleRepository";
import { upsertCalendarEvent } from "../../services/googleCalendar/GoogleCalendarService";
import { prisma } from "../../infra/data/prisma";

export class LeadUseCase implements ILeadUseCase {
  constructor(
    private leadRepository: ILeadRepository,
    private profileUseCase: IProfileUseCase,
  ) {}

  async createLead(supabaseId: string, data: CreateLeadRequest): Promise<Output> {
    return this.createLeadInternal(supabaseId, data, false);
  }

  async createLeadFromImport(supabaseId: string, data: CreateLeadRequest): Promise<Output> {
    const output = await this.createLeadInternal(supabaseId, data, true);

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

  private async createLeadInternal(
    supabaseId: string,
    data: CreateLeadRequest,
    skipAutoAssign: boolean
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

      const lead = await this.leadRepository.create({
        manager: { connect: { id: managerId } },
        leadCode,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        cnpj: data.cnpj || null,
        age: data.age || null,
        currentHealthPlan: data.currentHealthPlan || null,
        currentValue: data.currentValue || null,
        referenceHospital: data.referenceHospital || null,
        currentTreatment: data.currentTreatment || null,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : null,
        meetingNotes: data.meetingNotes || null,
        meetingLink: data.meetingLink || null,
        meetingHeald: data.meetingHeald || null,
        notes: data.notes || null,
        status: data.status || LeadStatus.new_opportunity,
        // Novos campos de venda (sempre null na criação)
        ticket: data.ticket || null,
        contractDueDate: data.contractDueDate ? new Date(data.contractDueDate) : null,
        soldPlan: data.soldPlan || null,
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
            body: "Lead criado no sistema",
            author: { connect: { id: profileInfo.id } }
          }
        }
      });

      return new Output(true, ["Lead criado com sucesso"], [], this.transformToDTO(lead));
    } catch (error) {
      console.error("Erro ao criar lead:", error);
      
      // Detectar erros específicos do Prisma
      if (error instanceof Error) {
        // Erro de unique constraint (telefone duplicado)
        if (error.message.includes('Unique constraint') || error.message.includes('unique constraint')) {
          if (data.phone) {
            return new Output(false, [], [`Já existe um lead com o telefone ${data.phone}`], null);
          }
          return new Output(false, [], ["Já existe um lead com estes dados"], null);
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

      return new Output(true, [], [], this.transformToDTO(lead));
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

      const managerId = profileInfo.role === 'manager' ? profileInfo.id : profileInfo.managerId;
      
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
    }
  ): Promise<Output> {
    try {
      // Buscar informações do perfil através do ProfileUseCase
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      let leads: any[] = [];

      if (options?.role === 'manager') {
        // Determinar o managerId base (master)
        // Se o usuário é master, usa o próprio ID
        // Se não é master, usa o managerId (aponta para o master)
        const baseMasterId = profileInfo.isMaster 
          ? profileInfo.id 
          : profileInfo.managerId;
        
        if (!baseMasterId) {
          return new Output(false, [], ["Master não identificado"], null);
        }

        // Manager (master ou não-master) vê todos os leads do master
        const result = await this.leadRepository.findAllByManagerId(baseMasterId, {
          status: options.status,
          assignedTo: options.assignedTo,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
        });
        
        leads = result.leads;
      } else if (options?.role === 'operator') {
        // Operator vê apenas leads criados por ele OU atribuídos a ele
        if (profileInfo.role !== 'operator') {
          return new Output(false, [], ["Usuário não é um operator"], null);
        }

        const result = await this.leadRepository.findAllByOperatorId(profileInfo.id, {
          status: options.status,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
        });
        
        leads = result.leads;
      } else {
        return new Output(false, [], ["Role inválido. Use 'manager' ou 'operator'"], null);
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

      const updateData: any = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.cnpj !== undefined) updateData.cnpj = data.cnpj || null;
      if (data.age !== undefined) updateData.age = data.age;
      if (data.currentHealthPlan !== undefined) updateData.currentHealthPlan = data.currentHealthPlan || null;
      if (data.currentValue !== undefined) updateData.currentValue = data.currentValue;
      if (data.referenceHospital !== undefined) updateData.referenceHospital = data.referenceHospital || null;
      if (data.currentTreatment !== undefined) updateData.currentTreatment = data.currentTreatment || null;
      if (data.meetingDate !== undefined) updateData.meetingDate = data.meetingDate ? new Date(data.meetingDate) : null;
      if (data.meetingNotes !== undefined) updateData.meetingNotes = data.meetingNotes || null;
      if (data.meetingLink !== undefined) updateData.meetingLink = data.meetingLink || null;
      if (data.meetingHeald !== undefined) updateData.meetingHeald = data.meetingHeald || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined) updateData.status = data.status;
      // Novos campos de venda
      if (data.ticket !== undefined) updateData.ticket = data.ticket;
      if (data.contractDueDate !== undefined) updateData.contractDueDate = data.contractDueDate ? new Date(data.contractDueDate) : null;
      if (data.soldPlan !== undefined) updateData.soldPlan = data.soldPlan || null;
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

  async updateLeadStatus(supabaseId: string, id: string, status: LeadStatus): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
      const profileInfo = await this.profileUseCase.getProfileInfoBySupabaseId(supabaseId);
      
      if (!profileInfo) {
        return new Output(false, [], ["Perfil do usuário não encontrado"], null);
      }

      // Buscar o lead para obter informações
      const existingLead = await this.leadRepository.findById(id);
      
      if (!existingLead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      // Atualizar o status do lead
      const lead = await this.leadRepository.updateStatus(id, status);

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

      // Se o status for scheduled, criar ou atualizar registro na tabela LeadsSchedule
      if (status === LeadStatus.scheduled) {
        const meetingDate = existingLead.meetingDate || new Date();
        
        // Verificar se já existe um agendamento para este lead
        const existingSchedule = await leadScheduleRepository.findLatestByLeadId(id);
        const shouldCreateCalendarEvent = !existingSchedule?.googleEventId;
        let calendarEventResult: { eventId: string; calendarId: string; meetLink?: string | null } | null = null;

        if (shouldCreateCalendarEvent) {
          const leadWithManager = await prisma.lead.findUnique({
            where: { id },
            include: {
              manager: true,
              closer: true,
            },
          });

          if (leadWithManager?.manager.googleCalendarConnected && leadWithManager.manager.googleRefreshToken) {
            try {
              calendarEventResult = await upsertCalendarEvent({
                organizer: leadWithManager.manager,
                lead: leadWithManager,
                closerEmail: leadWithManager.closer?.email || null,
                meetingDate,
                notes: existingLead.meetingNotes || undefined,
                meetingLink: existingLead.meetingLink || undefined,
                existingEventId: existingSchedule?.googleEventId ?? null,
              });
            } catch (error) {
              console.error("Erro ao criar evento no Google Calendar:", error);
            }
          }
        }

        if (existingSchedule) {
          // Atualizar agendamento existente
          await leadScheduleRepository.update(existingSchedule.id, {
            date: meetingDate,
            notes: `Lead agendado`,
            meetingLink: calendarEventResult?.meetLink ?? existingSchedule.meetingLink ?? undefined,
            googleEventId: calendarEventResult?.eventId ?? existingSchedule.googleEventId ?? undefined,
            googleCalendarId: calendarEventResult?.calendarId ?? existingSchedule.googleCalendarId ?? undefined,
          });
        } else {
          // Criar novo agendamento
          await leadScheduleRepository.create({
            leadId: id,
            date: meetingDate,
            notes: `Lead agendado`,
            meetingLink: calendarEventResult?.meetLink ?? existingLead.meetingLink ?? undefined,
            googleEventId: calendarEventResult?.eventId ?? undefined,
            googleCalendarId: calendarEventResult?.calendarId ?? undefined,
          });
        }

        // Se não tinha meetingDate, atualizar o lead com a data atual
        if (!existingLead.meetingDate) {
          await this.leadRepository.update(id, {
            meetingDate,
            meetingLink: calendarEventResult?.meetLink ?? undefined,
          });
        } else if (calendarEventResult?.meetLink && !existingLead.meetingLink) {
          await this.leadRepository.update(id, {
            meetingLink: calendarEventResult.meetLink,
          });
        }
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

      const lead = await this.leadRepository.assignToOperator(id, operatorId);
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

      const managerId = profileInfo.role === 'manager' ? profileInfo.id : profileInfo.managerId;
      
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
      if (profileInfo.role !== 'manager') {
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

  private transformToDTO(lead: any): LeadResponseDTO {
    return {
      id: lead.id,
      leadCode: lead.leadCode,
      managerId: lead.managerId,
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
      meetingNotes: lead.meetingNotes,
      meetingLink: lead.meetingLink,
      meetingHeald: lead.meetingHeald,
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
          ...(activity.author && {
            author: {
              id: activity.author.id,
              fullName: activity.author.fullName,
              email: activity.author.email,
            }
          })
        }))
      })
    };
  }
}
