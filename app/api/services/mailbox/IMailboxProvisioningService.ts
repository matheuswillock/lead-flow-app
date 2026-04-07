export interface MailboxProvisioningResult {
  address: string
  provisionedAt: Date
  status: "provisioned" | "pending_manual_action"
}

export interface IMailboxProvisioningService {
  provision(email: string, fullName: string): Promise<MailboxProvisioningResult>
}
