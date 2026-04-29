import type { BackofficeLead, BackofficeLeadStatus } from "@prisma/client"

export interface CreateBackofficeLeadInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: BackofficeLeadStatus
  createdByProfileId?: string | null
}

export interface UpdateBackofficeLeadInput {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export interface ListBackofficeLeadsParams {
  status?: BackofficeLeadStatus
}

export interface IBackofficeLeadRepository {
  create(data: CreateBackofficeLeadInput): Promise<BackofficeLead>
  findMany(params?: ListBackofficeLeadsParams): Promise<BackofficeLead[]>
  findById(id: string): Promise<BackofficeLead | null>
  update(id: string, data: UpdateBackofficeLeadInput): Promise<BackofficeLead>
  updateStatus(id: string, status: BackofficeLeadStatus): Promise<BackofficeLead>
  delete(id: string): Promise<void>
}
