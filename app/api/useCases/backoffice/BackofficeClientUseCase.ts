import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { CreateBackofficeClientInput, IBackofficeClientRepository } from "../../infra/data/repositories/backoffice/ClientRepository/IBackofficeClientRepository"

export interface CreateClientInput {
  fullName: string
  email?: string
  phone?: string
  cpfCnpj?: string
  notes?: string
}

export class BackofficeClientUseCase {
  constructor(private clientRepo: IBackofficeClientRepository) {}

  async createClient(data: CreateClientInput, createdByProfileId: string): Promise<Output> {
    try {
      if (!data.fullName || data.fullName.trim().length < 2) {
        return new Output(false, [], ["Nome completo deve ter pelo menos 2 caracteres"], null)
      }

      // Telefone é obrigatório no cadastro: o contrato de pagamento exige celular em qualquer cobrança.
      if ((data.phone ?? "").replace(/\D/g, "").length < 10) {
        return new Output(false, [], ["Telefone é obrigatório"], null)
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

      // O cliente no provedor de cobrança é criado no momento da cobrança (lib/payment-provider).
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
