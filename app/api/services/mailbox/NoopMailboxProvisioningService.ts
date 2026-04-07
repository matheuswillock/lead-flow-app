import type {
  IMailboxProvisioningService,
  MailboxProvisioningResult,
} from "./IMailboxProvisioningService"

export class NoopMailboxProvisioningService implements IMailboxProvisioningService {
  async provision(email: string): Promise<MailboxProvisioningResult> {
    // Hostinger API não integrada — registra como pendente de ação manual
    console.info("[NoopMailboxProvisioningService] Mailbox pendente de ação manual:", email)
    return {
      address: email,
      provisionedAt: new Date(),
      status: "pending_manual_action",
    }
  }
}

export const noopMailboxProvisioningService = new NoopMailboxProvisioningService()
