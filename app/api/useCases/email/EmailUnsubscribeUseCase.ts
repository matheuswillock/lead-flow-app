import { Output } from "@/lib/output"
import { prisma } from "@/app/api/infra/data/prisma"
import { parseEmailUnsubscribeToken, maskEmailForUnsubscribe } from "@/lib/email/unsubscribe-token"

export class EmailUnsubscribeUseCase {
  async getInfo(token: string): Promise<Output> {
    const parsed = parseEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Link inválido ou expirado"], null)
    }

    const contact = await prisma.emailContact.findFirst({
      where: { id: parsed.contactId, list: { teamId: parsed.teamId } },
      select: {
        email: true,
        list: { select: { team: { select: { name: true } } } },
      },
    })

    if (!contact) {
      return new Output(true, [], [], {
        teamName: "Time",
        maskedEmail: "•••@•••",
        alreadyUnsubscribed: true,
      })
    }

    return new Output(true, [], [], {
      teamName: contact.list.team.name,
      maskedEmail: maskEmailForUnsubscribe(contact.email),
      alreadyUnsubscribed: false,
    })
  }

  async unsubscribe(token: string): Promise<Output> {
    const parsed = parseEmailUnsubscribeToken(token)
    if (!parsed) {
      return new Output(false, [], ["Não foi possível processar o descadastro"], null)
    }

    const contact = await prisma.emailContact.findFirst({
      where: { id: parsed.contactId, list: { teamId: parsed.teamId } },
      select: { id: true, isUnsubscribed: true },
    })

    if (!contact) {
      return new Output(true, ["Descadastro confirmado"], [], { unsubscribed: true })
    }

    if (!contact.isUnsubscribed) {
      await prisma.emailContact.update({
        where: { id: contact.id },
        data: { isUnsubscribed: true },
      })
    }

    return new Output(true, ["Você não receberá mais e-mails deste time"], [], { unsubscribed: true })
  }
}
