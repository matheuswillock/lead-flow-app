import { Lead, LeadStatus, Prisma } from "@prisma/client";

export interface ILeadRepository {
  create(data: Prisma.LeadCreateInput): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  findByManagerId(
    managerId: string, 
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      page?: number;
      limit?: number;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[]; total: number }>;
  update(id: string, data: Prisma.LeadUpdateInput): Promise<Lead>;
  delete(id: string): Promise<void>;
  updateStatus(id: string, status: LeadStatus): Promise<Lead>;
  assignToOperator(id: string, operatorId: string): Promise<Lead>;
  transferToManager(id: string, newManagerId: string, reason?: string): Promise<Lead>;
  getLeadsByStatus(managerId: string, status: LeadStatus): Promise<Lead[]>;
}