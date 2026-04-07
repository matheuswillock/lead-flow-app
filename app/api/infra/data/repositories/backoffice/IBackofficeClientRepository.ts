import type { BackofficeClient } from "@prisma/client"

export interface CreateBackofficeClientInput {
  id: string
  fullName: string
  email?: string
  phone?: string
  cpfCnpj?: string
  notes?: string
  createdByProfileId?: string
}

export interface IBackofficeClientRepository {
  create(data: CreateBackofficeClientInput): Promise<BackofficeClient>
  findMany(params?: { isActive?: boolean }): Promise<BackofficeClient[]>
  findById(id: string): Promise<BackofficeClient | null>
  updateAsaasCustomerId(id: string, asaasCustomerId: string): Promise<BackofficeClient>
}
