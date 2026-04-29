import type { BackofficeLeadStatus } from "@prisma/client"
import type { Output } from "@/lib/output"

export interface CreateBackofficeLeadDTO {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: BackofficeLeadStatus
}

export interface UpdateBackofficeLeadDTO {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export interface IBackofficeLeadUseCase {
  listLeads(params?: { status?: BackofficeLeadStatus }): Promise<Output>
  getLeadById(id: string): Promise<Output>
  createLead(data: CreateBackofficeLeadDTO, createdByProfileId: string): Promise<Output>
  updateLead(id: string, data: UpdateBackofficeLeadDTO): Promise<Output>
  updateLeadStatus(id: string, status: BackofficeLeadStatus): Promise<Output>
  deleteLead(id: string): Promise<Output>
}
