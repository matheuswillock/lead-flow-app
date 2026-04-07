import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import type {
  IBackofficeClientRepository,
  CreateBackofficeClientInput,
} from "@/app/api/infra/data/repositories/backoffice/IBackofficeClientRepository"
import type { IAsaasCustomerService } from "@/app/api/services/AsaasCustomer/IAsaasCustomerService"
import type { AsaasCustomer } from "@/app/api/services/AsaasCustomer/AsaasCustomerService"

export interface CreateClientInput {
  fullName: string
  email?: string
  phone?: string
  cpfCnpj?: string
  notes?: string
}

export class BackofficeClientUseCase {
  constructor(
    private clientRepo: IBackofficeClientRepository,
    private asaasCustomerService: IAsaasCustomerService
  ) {}

  async createClient(data: CreateClientInput, createdByProfileId: string): Promise<Output> {
    try {
      if (!data.fullName || data.fullName.trim().length < 2) {
        return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
      }

      const id = randomUUID()

      const input: CreateBackofficeClientInput = {
        id,
        fullName: data.fullName.trim(),
        email: data.email?.trim(),
        phone: data.phone?.trim(),
        cpfCnpj: data.cpfCnpj?.trim(),
        notes: data.notes?.trim(),
        createdByProfileId,
      }

      const client = await this.clientRepo.create(input)

      // Criar cliente no Asaas se tiver CPF/CNPJ
      if (data.cpfCnpj) {
        try {
          const asaasPayload: AsaasCustomer = {
            name: data.fullName.trim(),
            email: data.email ?? "",
            cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
            mobilePhone: data.phone,
            externalReference: id,
          }
          const asaasResult = await this.asaasCustomerService.createCustomer(asaasPayload)
          if (asaasResult.success && asaasResult.customerId) {
            await this.clientRepo.updateAsaasCustomerId(id, asaasResult.customerId)
            return new Output(
              true,
              ["Cliente criado com sucesso"],
              [],
              { ...client, asaasCustomerId: asaasResult.customerId }
            )
          }
        } catch (asaasError) {
          console.error("[BackofficeClientUseCase] Erro ao criar cliente Asaas:", asaasError)
          // Cliente local criado, Asaas falhou — retorna sucesso parcial
          return new Output(
            true,
            ["Cliente criado. Integração Asaas pendente."],
            [],
            client
          )
        }
      }

      return new Output(true, ["Cliente criado com sucesso"], [], client)
    } catch (error) {
      console.error("[BackofficeClientUseCase][createClient]", error)
      return new Output(false, [], ["Erro ao criar cliente"], null)
    }
  }

  async listClients(): Promise<Output> {
    try {
      const clients = await this.clientRepo.findMany({ isActive: true })
      return new Output(true, [], [], clients)
    } catch (error) {
      console.error("[BackofficeClientUseCase][listClients]", error)
      return new Output(false, [], ["Erro ao listar clientes"], null)
    }
  }

  async getClientById(id: string): Promise<Output> {
    try {
      const client = await this.clientRepo.findById(id)
      if (!client) {
        return new Output(false, [], ["Cliente não encontrado"], null)
      }
      return new Output(true, [], [], client)
    } catch (error) {
      console.error("[BackofficeClientUseCase][getClientById]", error)
      return new Output(false, [], ["Erro ao buscar cliente"], null)
    }
  }
}
