import { Output } from "@/lib/output"
import { parseBackofficeEmailUnsubscribeToken, maskEmailForUnsubscribe } from "@/lib/email/backoffice-unsubscribe-token"
import {
  backofficeEmailContactRepository,
  type BackofficeEmailContactRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContact/BackofficeEmailContactRepository"

export class BackofficeEmailCampaignUnsubscribeUseCase {
  constructor(
    private readonly contactRepository: BackofficeEmailContactRepository = backofficeEmailContactRepository
  ) {}

  async getInfo(token: string): Promise<Output> {
    const parsed = parseBackofficeEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Link inválido ou expirado"], null)
    }

    const contact = await this.contactRepository.findById(parsed.contactId)
    if (!contact) {
      return new Output(false, [], ["Contato não encontrado"], null)
    }

    return new Output(true, [], [], {
      maskedEmail: maskEmailForUnsubscribe(contact.email),
      alreadyUnsubscribed: contact.isUnsubscribed,
    })
  }

  async unsubscribe(token: string): Promise<Output> {
    const parsed = parseBackofficeEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Link inválido ou expirado"], null)
    }

    const contact = await this.contactRepository.findById(parsed.contactId)
    if (!contact) {
      return new Output(false, [], ["Contato não encontrado"], null)
    }

    if (contact.isUnsubscribed) {
      return new Output(true, ["Você já estava descadastrado"], [], { alreadyUnsubscribed: true })
    }

    await this.contactRepository.markUnsubscribed(contact.id)
    return new Output(true, ["Descadastro realizado com sucesso"], [], { alreadyUnsubscribed: false })
  }
}

export const backofficeEmailCampaignUnsubscribeUseCase = new BackofficeEmailCampaignUnsubscribeUseCase()
