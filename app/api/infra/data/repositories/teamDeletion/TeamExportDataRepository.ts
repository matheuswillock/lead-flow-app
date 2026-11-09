import { prisma } from "@/app/api/infra/data/prisma"
import type { ExportTable } from "@/app/api/shared/teamDeletion/teamDeletionTypes"

const BATCH_SIZE = 1000

/** Lê uma tabela inteira em lotes (cursor pelo id), sem carregar tudo numa consulta só. */
async function readAll<T extends { id: string }>(load: (cursor: string | undefined, take: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = []
  let cursor: string | undefined
  for (;;) {
    const batch = await load(cursor, BATCH_SIZE)
    all.push(...batch)
    if (batch.length < BATCH_SIZE) return all
    cursor = batch[batch.length - 1].id
  }
}

const cursorArgs = (cursor: string | undefined): { cursor?: { id: string }; skip?: number } =>
  cursor ? { cursor: { id: cursor }, skip: 1 } : {}

/**
 * Lê as informações de um time para o ZIP de exportação. Uma tabela (planilha) por área. Não inclui o
 * conteúdo das mensagens de WhatsApp nem os arquivos dos anexos (só a lista deles).
 */
export class TeamExportDataRepository {
  async collect(teamId: string): Promise<ExportTable[]> {
    return [
      await this.team(teamId),
      await this.members(teamId),
      await this.leads(teamId),
      await this.portfolio(teamId),
      await this.contracts(teamId),
      await this.activities(teamId),
      await this.tasks(teamId),
      await this.schedules(teamId),
      await this.attachments(teamId),
      await this.forms(teamId),
      await this.formSubmissions(teamId),
      await this.emailContacts(teamId),
      await this.emailCampaigns(teamId),
    ]
  }

  private async team(teamId: string): Promise<ExportTable> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, name: true, isDefault: true, meetingDurationMinutes: true, createdAt: true },
    })
    return {
      fileName: "time.csv",
      rows: team
        ? [{ id: team.id, nome: team.name, padrao: team.isDefault, duracao_reuniao_min: team.meetingDurationMinutes, criado_em: team.createdAt }]
        : [],
    }
  }

  private async members(teamId: string): Promise<ExportTable> {
    const members = await prisma.teamMember.findMany({
      where: { teamId },
      select: {
        role: true,
        functions: true,
        createdAt: true,
        profile: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    })
    return {
      fileName: "membros.csv",
      rows: members.map((member) => ({
        nome: member.profile.fullName,
        email: member.profile.email,
        papel: member.role,
        funcoes: member.functions.join(", "),
        entrou_em: member.createdAt,
      })),
    }
  }

  private async leads(teamId: string): Promise<ExportTable> {
    const leads = await readAll((cursor, take) =>
      prisma.lead.findMany({
        where: { teamId },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          leadCode: true,
          name: true,
          email: true,
          phone: true,
          cnpj: true,
          razaoSocial: true,
          age: true,
          status: true,
          currentHealthPlan: true,
          currentValue: true,
          referenceHospital: true,
          currentTreatment: true,
          ticket: true,
          soldPlan: true,
          contractDueDate: true,
          lossReason: true,
          lossReasonDetails: true,
          notes: true,
          isReferral: true,
          referrerName: true,
          referrerPhone: true,
          meetingDate: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          assignee: { select: { fullName: true } },
          closer: { select: { fullName: true } },
        },
      }),
    )
    return {
      fileName: "leads.csv",
      rows: leads.map(({ assignee, closer, ...lead }) => ({
        ...lead,
        sdr: assignee?.fullName ?? null,
        closer: closer?.fullName ?? null,
      })),
    }
  }

  private async portfolio(teamId: string): Promise<ExportTable> {
    const entries = await readAll((cursor, take) =>
      prisma.leadPortfolio.findMany({
        where: { teamId },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          portfolioStatus: true,
          renewalStatus: true,
          renewalAmount: true,
          source: true,
          note: true,
          lastContactAt: true,
          createdAt: true,
          lead: { select: { leadCode: true, name: true } },
        },
      }),
    )
    return {
      fileName: "carteira.csv",
      rows: entries.map(({ lead, ...entry }) => ({ lead_codigo: lead.leadCode, lead_nome: lead.name, ...entry })),
    }
  }

  private async contracts(teamId: string): Promise<ExportTable> {
    const contracts = await readAll((cursor, take) =>
      prisma.leadFinalized.findMany({
        where: { lead: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          contractType: true,
          finalizedDateAt: true,
          startDateAt: true,
          amount: true,
          operadora: true,
          productName: true,
          notes: true,
          lead: { select: { leadCode: true, name: true } },
          closer: { select: { fullName: true } },
          holder: { select: { name: true, razaoSocial: true, birthDate: true, document: true, cnpj: true } },
        },
      }),
    )
    return {
      fileName: "contratos.csv",
      rows: contracts.map(({ lead, closer, holder, ...contract }) => ({
        lead_codigo: lead.leadCode,
        lead_nome: lead.name,
        closer: closer?.fullName ?? null,
        titular_nome: holder?.name ?? null,
        titular_razao_social: holder?.razaoSocial ?? null,
        titular_nascimento: holder?.birthDate ?? null,
        titular_documento: holder?.document ?? null,
        titular_cnpj: holder?.cnpj ?? null,
        ...contract,
      })),
    }
  }

  private async activities(teamId: string): Promise<ExportTable> {
    const activities = await readAll((cursor, take) =>
      prisma.leadActivity.findMany({
        where: { lead: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          type: true,
          body: true,
          outcome: true,
          duration: true,
          contactDate: true,
          contactTime: true,
          createdAt: true,
          lead: { select: { leadCode: true } },
        },
      }),
    )
    return {
      fileName: "atividades.csv",
      rows: activities.map(({ lead, ...activity }) => ({ lead_codigo: lead.leadCode, ...activity })),
    }
  }

  private async tasks(teamId: string): Promise<ExportTable> {
    const tasks = await readAll((cursor, take) =>
      prisma.task.findMany({
        where: { lead: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          title: true,
          body: true,
          isUrgent: true,
          startAt: true,
          endAt: true,
          createdAt: true,
          lead: { select: { leadCode: true } },
        },
      }),
    )
    return {
      fileName: "tarefas.csv",
      rows: tasks.map(({ lead, ...task }) => ({ lead_codigo: lead.leadCode, ...task })),
    }
  }

  private async schedules(teamId: string): Promise<ExportTable> {
    const schedules = await readAll((cursor, take) =>
      prisma.leadsSchedule.findMany({
        where: { lead: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          date: true,
          meetingDurationMinutes: true,
          meetingTitle: true,
          meetingType: true,
          meetingLink: true,
          notes: true,
          extraGuests: true,
          noShowCount: true,
          createdAt: true,
          lead: { select: { leadCode: true, name: true } },
        },
      }),
    )
    return {
      fileName: "agenda.csv",
      rows: schedules.map(({ lead, ...schedule }) => ({ lead_codigo: lead.leadCode, lead_nome: lead.name, ...schedule })),
    }
  }

  /** Só a lista dos anexos (nome, tipo, tamanho e data): os arquivos em si não entram no ZIP. */
  private async attachments(teamId: string): Promise<ExportTable> {
    const attachments = await readAll((cursor, take) =>
      prisma.leadAttachment.findMany({
        where: { lead: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          fileName: true,
          fileType: true,
          fileSize: true,
          uploadedAt: true,
          lead: { select: { leadCode: true } },
        },
      }),
    )
    return {
      fileName: "anexos.csv",
      rows: attachments.map(({ lead, ...attachment }) => ({ lead_codigo: lead.leadCode, ...attachment })),
    }
  }

  private async forms(teamId: string): Promise<ExportTable> {
    const forms = await prisma.publicForm.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, description: true, publicId: true, formKind: true, createdAt: true },
    })
    return { fileName: "formularios.csv", rows: forms }
  }

  private async formSubmissions(teamId: string): Promise<ExportTable> {
    const submissions = await readAll((cursor, take) =>
      prisma.publicFormSubmission.findMany({
        where: { form: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: { id: true, formId: true, leadId: true, score: true, scoreBandLabel: true, submittedAt: true },
      }),
    )
    return { fileName: "envios-de-formularios.csv", rows: submissions }
  }

  private async emailContacts(teamId: string): Promise<ExportTable> {
    const contacts = await readAll((cursor, take) =>
      prisma.emailContact.findMany({
        where: { list: { teamId } },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          email: true,
          name: true,
          customFields: true,
          isUnsubscribed: true,
          isBounced: true,
          isComplained: true,
          createdAt: true,
          list: { select: { name: true } },
        },
      }),
    )
    return {
      fileName: "contatos-email.csv",
      rows: contacts.map(({ list, ...contact }) => ({ lista: list.name, ...contact })),
    }
  }

  private async emailCampaigns(teamId: string): Promise<ExportTable> {
    const campaigns = await readAll((cursor, take) =>
      prisma.emailCampaign.findMany({
        where: { teamId },
        orderBy: { id: "asc" },
        take,
        ...cursorArgs(cursor),
        select: {
          id: true,
          name: true,
          description: true,
          scheduledAt: true,
          sentAt: true,
          totalRecipients: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalBounced: true,
          totalComplained: true,
          createdAt: true,
        },
      }),
    )
    return { fileName: "campanhas-email.csv", rows: campaigns }
  }
}

export const teamExportDataRepository = new TeamExportDataRepository()
