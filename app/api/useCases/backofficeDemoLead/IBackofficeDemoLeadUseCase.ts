import type { Output } from "@/lib/output"

export interface CreateDemoLeadInput {
  name: string
  email: string
  phone: string
  firstName?: string | null
  lastName?: string | null
  teamSize?: string | null
  preferredContactTime?: string | null
}

export interface IBackofficeDemoLeadUseCase {
  create(input: CreateDemoLeadInput): Promise<Output>
}
