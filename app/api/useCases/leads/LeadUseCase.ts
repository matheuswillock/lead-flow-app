import { ILeadUseCase } from "./ILeadUseCase";
import { ILeadRepository } from "../../infra/data/repositories/lead/ILeadRepository";
import { IProfileUseCase } from "../profiles/IProfileUseCase";
import { Output } from "@/lib/output";
import { LeadStatus, ActivityType } from "@prisma/client";
import { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "../../v1/leads/DTO/requestToUpdateLead";
import { LeadResponseDTO } from "../../v1/leads/DTO/leadResponseDTO";

export class LeadUseCase implements ILeadUseCase {
  constructor(
    private leadRepository: ILeadRepository,
    private profileUseCase: IProfileUseCase
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
        hasHealthPlan: data.hasHealthPlan || null,
        currentValue: data.currentValue || null,
        referenceHospital: data.referenceHospital || null,
        currentTreatment: data.currentTreatment || null,
        meetingDate: data.meetingDate ? new Date(data.meetingDate) : null,
        notes: data.notes || null,
        status: data.status || LeadStatus.new_opportunity,
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
      return new Output(false, [], ["Erro interno do servidor ao criar lead"], null);
    }
  }

  async getLeadById(supabaseId: string, id: string): Promise<Output> {
    try {
      // Verificar se o usuário existe e tem permissão
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
      if (data.hasHealthPlan !== undefined) updateData.hasHealthPlan = data.hasHealthPlan;
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

      const lead = await this.leadRepository.updateStatus(id, status);
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
      hasHealthPlan: lead.hasHealthPlan,
      currentValue: lead.currentValue ? Number(lead.currentValue) : null,
      referenceHospital: lead.referenceHospital,
      currentTreatment: lead.currentTreatment,
      meetingDate: lead.meetingDate ? lead.meetingDate.toISOString() : null,
      notes: lead.notes,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
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