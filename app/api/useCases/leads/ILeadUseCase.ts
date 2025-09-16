import { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import { CreateLeadRequest } from "../../v1/leads/DTO/requestToCreateLead";
import { UpdateLeadRequest } from "../../v1/leads/DTO/requestToUpdateLead";

export interface ILeadUseCase {
  createLead(supabaseId: string, data: CreateLeadRequest): Promise<Output>;
  getLeadById(supabaseId: string, id: string): Promise<Output>;
  getLeadsByManager(
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
  ): Promise<Output>;
  updateLead(supabaseId: string, id: string, data: UpdateLeadRequest): Promise<Output>;
  deleteLead(supabaseId: string, id: string): Promise<Output>;
  updateLeadStatus(supabaseId: string, id: string, status: LeadStatus): Promise<Output>;
  assignLeadToOperator(supabaseId: string, id: string, operatorId: string): Promise<Output>;
  getLeadsByStatus(supabaseId: string, status: LeadStatus): Promise<Output>;
}