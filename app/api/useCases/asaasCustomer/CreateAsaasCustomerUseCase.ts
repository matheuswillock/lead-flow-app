import { Output } from "@/lib/output"
import {
  asaasCustomerGateway as defaultAsaasCustomerGateway,
} from "@/app/api/infra/gateways/asaasCustomer/AsaasCustomerGateway"
import type {
  CreateAsaasCustomerInput,
  IAsaasCustomerGateway,
} from "@/app/api/infra/gateways/asaasCustomer/IAsaasCustomerGateway"

/**
 * E5 de [[10 — Fundações Multi-conta — Backend]] — Route -> UseCase ->
 * Service, para app/api/email/asaas/customer/route.ts (a rota MUST NOT
 * chamar o gateway/Service direto).
 */
export class CreateAsaasCustomerUseCase {
  constructor(
    private readonly asaasCustomerGateway: IAsaasCustomerGateway = defaultAsaasCustomerGateway
  ) {}

  async execute(input: CreateAsaasCustomerInput): Promise<Output> {
    try {
      const customer = await this.asaasCustomerGateway.createCustomer(input)
      return new Output(true, ["Customer created successfully"], [], customer)
    } catch (error: any) {
      return new Output(false, [], [error.message || "Failed to create customer"], null)
    }
  }
}

export const createAsaasCustomerUseCase = new CreateAsaasCustomerUseCase()
