import type { Output } from "@/lib/output"

export interface CreateDemoLeadInput {
  name: string
  email: string
  phone: string
}

export interface IBackofficeDemoLeadUseCase {
  create(input: CreateDemoLeadInput): Promise<Output>
}
