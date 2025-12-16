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

export class LeadUseCase implements ILeadUseCase {
  constructor(
    private leadRepository: ILeadRepository,
    private profileUseCase: IProfileUseCase,
  ) {}

  async createLead(supabaseId: string, data: CreateLeadRequest): Promise<Output> {
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
      const lead = await this.leadRepository.create({
        manager: { connect: { id: managerId } },
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
        notes: data.notes || null,
        status: data.status || LeadStatus.new_opportunity,
        creator: { connect: { id: profileInfo.id } },
        updater: { connect: { id: profileInfo.id } },
        ...(data.assignedTo && {
          assignee: { connect: { id: data.assignedTo } }
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
        // Se for manager, busca todos os leads do manager (incluindo dos operators)
        const managerId = profileInfo.role === 'manager' ? profileInfo.id : profileInfo.managerId;
        
        if (!managerId) {
          return new Output(false, [], ["Manager não identificado"], null);
        }

        const result = await this.leadRepository.findAllByManagerId(managerId, {
          status: options.status,
          assignedTo: options.assignedTo,
          search: options.search,
          startDate: options.startDate,
          endDate: options.endDate,
        });
        
        leads = result.leads;
      } else if (options?.role === 'operator') {
        // Se for operator, busca apenas os leads atribuídos a ele
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
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.assignedTo !== undefined) {
        if (data.assignedTo) {
          updateData.assignee = { connect: { id: data.assignedTo } };
        } else {
          updateData.assignee = { disconnect: true };
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
        
        if (existingSchedule) {
          // Atualizar agendamento existente
          await leadScheduleRepository.update(existingSchedule.id, {
            date: meetingDate,
            notes: `Lead agendado`,
          });
        } else {
          // Criar novo agendamento
          await leadScheduleRepository.create({
            leadId: id,
            date: meetingDate,
            notes: `Lead agendado`,
          });
        }

        // Se não tinha meetingDate, atualizar o lead com a data atual
        if (!existingLead.meetingDate) {
          await this.leadRepository.update(id, {
            meetingDate,
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
      notes: lead.notes,
      createdBy: lead.createdBy,
      updatedBy: lead.updatedBy,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
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