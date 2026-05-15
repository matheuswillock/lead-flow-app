import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import type {
  IPortfolioService,
  PortfolioDetailResult,
  PortfolioFilters,
  PortfolioListResult,
  PortfolioRow,
  UpdatePortfolioData,
  UpdatePortfolioDetailPayload,
} from './IPortfolioService';

function mapToPortfolioRow(entry: {
  id: string;
  portfolioStatus: string;
  note: string | null;
  lastContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lead: {
    id: string;
    leadCode: string;
    name: string;
    ticket: { toNumber(): number } | null;
    currentValue: { toNumber(): number } | null;
    soldPlan: string | null;
    contractDueDate: Date | null;
    assignee: { id: string; fullName: string | null } | null;
    closer: { id: string; fullName: string | null } | null;
    LeadFinalized: { operadora: string | null; startDateAt: Date }[];
  };
}): PortfolioRow {
  const ticket = entry.lead.ticket ? entry.lead.ticket.toNumber() : 0;
  const currentValue = entry.lead.currentValue ? entry.lead.currentValue.toNumber() : 0;
  const finalized = entry.lead.LeadFinalized[0] ?? null;
  return {
    portfolioId: entry.id,
    leadId: entry.lead.id,
    leadCode: entry.lead.leadCode,
    leadName: entry.lead.name,
    portfolioStatus: entry.portfolioStatus as PortfolioRow['portfolioStatus'],
    note: entry.note,
    lastContactAt: entry.lastContactAt,
    sdr: entry.lead.assignee
      ? { id: entry.lead.assignee.id, name: entry.lead.assignee.fullName ?? '' }
      : null,
    closer: entry.lead.closer
      ? { id: entry.lead.closer.id, name: entry.lead.closer.fullName ?? '' }
      : null,
    soldPlan: entry.lead.soldPlan,
    operadora: finalized?.operadora ?? null,
    contractStartDate: finalized?.startDateAt ?? null,
    ticket: entry.lead.ticket ? entry.lead.ticket.toNumber() : null,
    currentValue: entry.lead.currentValue ? entry.lead.currentValue.toNumber() : null,
    saleValue: ticket > 0 ? ticket : currentValue,
    contractDueDate: entry.lead.contractDueDate,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

const leadInclude = {
  lead: {
    select: {
      id: true,
      leadCode: true,
      name: true,
      ticket: true,
      currentValue: true,
      soldPlan: true,
      contractDueDate: true,
      closerId: true,
      assignee: { select: { id: true, fullName: true } },
      closer: { select: { id: true, fullName: true } },
      LeadFinalized: {
        select: { operadora: true, startDateAt: true },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.LeadPortfolioInclude;

export class PortfolioService implements IPortfolioService {
  async listPortfolio(filters: PortfolioFilters): Promise<PortfolioListResult> {
    const {
      teamId, profileId, isManager, isCloser,
      portfolioStatuses, sdrIds, closerIds,
      operadora,
      contractDateStart, contractDateEnd,
      dueDateStart, dueDateEnd,
      documentSearch,
      search,
      page, pageSize,
    } = filters;

    const needsLeadFinalizedJoin = contractDateStart || contractDateEnd || documentSearch || operadora;

    const accessLeadFilter = {
      ...(isCloser && !isManager ? { closerId: profileId } : {}),
    };

    const where: Prisma.LeadPortfolioWhereInput = {
      teamId,
      ...(portfolioStatuses?.length ? { portfolioStatus: { in: portfolioStatuses } } : {}),
      lead: {
        ...accessLeadFilter,
        ...(sdrIds?.length ? { assignedTo: { in: sdrIds } } : {}),
        ...(closerIds?.length && (isManager || !isCloser) ? { closerId: { in: closerIds } } : {}),
        ...(search ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } } : {}),
        ...(dueDateStart || dueDateEnd ? {
          contractDueDate: {
            ...(dueDateStart ? { gte: dueDateStart } : {}),
            ...(dueDateEnd ? { lt: dueDateEnd } : {}),
          },
        } : {}),
        ...(needsLeadFinalizedJoin ? {
          LeadFinalized: {
            some: {
              AND: [
                ...(contractDateStart || contractDateEnd ? [{
                  startDateAt: {
                    ...(contractDateStart ? { gte: contractDateStart } : {}),
                    ...(contractDateEnd ? { lt: contractDateEnd } : {}),
                  },
                }] : []),
                ...(operadora ? [{
                  operadora: { equals: operadora, mode: Prisma.QueryMode.insensitive },
                }] : []),
                ...(documentSearch ? [{
                  OR: [
                    { holder: { document: { contains: documentSearch, mode: Prisma.QueryMode.insensitive } } },
                    { holder: { cnpj: { contains: documentSearch, mode: Prisma.QueryMode.insensitive } } },
                    { dependents: { some: { document: { contains: documentSearch, mode: Prisma.QueryMode.insensitive } } } },
                  ],
                }] : []),
              ],
            },
          },
        } : {}),
      },
    };

    const operadorasBaseWhere: Prisma.LeadFinalizedWhereInput = {
      lead: {
        portfolio: { teamId },
        ...accessLeadFilter,
      },
      operadora: { not: null },
    };

    const [totalRows, entries, operadoraRecords] = await Promise.all([
      prisma.leadPortfolio.count({ where }),
      prisma.leadPortfolio.findMany({
        where,
        include: leadInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.leadFinalized.findMany({
        where: operadorasBaseWhere,
        select: { operadora: true },
        distinct: ['operadora'],
        orderBy: { operadora: 'asc' },
      }),
    ]);

    const availableOperadoras = operadoraRecords
      .map((r) => r.operadora!)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return {
      rows: entries.map(mapToPortfolioRow),
      availableOperadoras,
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      },
    };
  }

  private async fetchDetailResult(leadId: string): Promise<PortfolioDetailResult> {
    const [entry, finalized, attachments] = await Promise.all([
      prisma.leadPortfolio.findUnique({
        where: { leadId },
        include: leadInclude,
      }),
      prisma.leadFinalized.findFirst({
        where: { leadId },
        include: {
          holder: true,
          dependents: { orderBy: { createdAt: 'asc' } },
          closer: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leadAttachment.findMany({
        where: { leadId },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          fileSize: true,
          uploadedAt: true,
          uploader: { select: { fullName: true } },
        },
        orderBy: { uploadedAt: 'desc' },
      }),
    ]);

    if (!entry) throw new Error('Entrada de carteira não encontrada');

    const ticket = entry.lead.ticket ? entry.lead.ticket.toNumber() : 0;
    const currentValue = entry.lead.currentValue ? entry.lead.currentValue.toNumber() : 0;

    return {
      portfolioId: entry.id,
      leadId: entry.lead.id,
      leadCode: entry.lead.leadCode,
      leadName: entry.lead.name,
      saleValue: ticket > 0 ? ticket : currentValue,
      portfolioStatus: entry.portfolioStatus,
      sdr: entry.lead.assignee ? { id: entry.lead.assignee.id, name: entry.lead.assignee.fullName ?? '' } : null,
      closer: entry.lead.closer ? { id: entry.lead.closer.id, name: entry.lead.closer.fullName ?? '' } : null,
      soldPlan: entry.lead.soldPlan,
      contractDueDate: entry.lead.contractDueDate,
      contract: finalized
        ? {
            operadora: finalized.operadora ?? null,
            productName: finalized.productName ?? null,
            amount: finalized.amount.toNumber(),
            startDateAt: finalized.startDateAt,
            finalizedDateAt: finalized.finalizedDateAt,
            contractFileUrl: finalized.contractFileUrl ?? null,
            notes: finalized.notes ?? null,
            closerName: finalized.closer?.fullName ?? null,
          }
        : null,
      holder: finalized?.holder
        ? {
            name: finalized.holder.name,
            birthDate: finalized.holder.birthDate,
            document: finalized.holder.document,
            cnpj: finalized.holder.cnpj ?? null,
          }
        : null,
      dependents: (finalized?.dependents ?? []).map((d) => ({
        id: d.id,
        name: d.name,
        birthDate: d.birthDate,
        parentesco: d.parentesco,
        document: d.document ?? null,
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize,
        uploadedAt: a.uploadedAt,
        uploaderName: a.uploader.fullName ?? null,
      })),
    };
  }

  async getPortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean
  ): Promise<PortfolioDetailResult> {
    const entry = await prisma.leadPortfolio.findUnique({
      where: { leadId },
      select: { id: true, teamId: true, lead: { select: { closerId: true } } },
    });

    if (!entry || entry.teamId !== teamId) {
      throw new Error('Entrada de carteira não encontrada');
    }
    if (isCloser && !isManager && entry.lead.closerId !== profileId) {
      throw new Error('Acesso negado: você só pode visualizar leads da sua própria carteira');
    }

    return this.fetchDetailResult(leadId);
  }

  async updatePortfolioEntryDetail(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    payload: UpdatePortfolioDetailPayload
  ): Promise<PortfolioDetailResult> {
    const entry = await prisma.leadPortfolio.findUnique({
      where: { leadId },
      select: { id: true, teamId: true, lead: { select: { closerId: true } } },
    });

    if (!entry || entry.teamId !== teamId) {
      throw new Error('Entrada de carteira não encontrada');
    }
    if (isCloser && !isManager && entry.lead.closerId !== profileId) {
      throw new Error('Acesso negado: você só pode editar leads da sua própria carteira');
    }

    const finalized = await prisma.leadFinalized.findFirst({
      where: { leadId },
      select: { id: true, dependents: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    await prisma.$transaction(async (tx) => {
      const sharedDueDate =
        payload.finalizedDateAt !== undefined
          ? payload.finalizedDateAt
          : payload.contractDueDate;

      // Update Lead fields
      const leadPatch: Prisma.LeadUpdateInput = {};
      if (sharedDueDate !== undefined) {
        leadPatch.contractDueDate = sharedDueDate ? new Date(sharedDueDate) : null;
      }
      if (payload.soldPlan !== undefined) leadPatch.soldPlan = payload.soldPlan;
      if (Object.keys(leadPatch).length > 0) {
        await tx.lead.update({ where: { id: leadId }, data: leadPatch });
      }

      if (finalized) {
        // Update LeadFinalized fields
        const finalizedPatch: Prisma.LeadFinalizedUpdateInput = {};
        if (payload.operadora !== undefined) finalizedPatch.operadora = payload.operadora;
        if (payload.productName !== undefined) finalizedPatch.productName = payload.productName;
        if (payload.amount !== undefined) finalizedPatch.amount = payload.amount;
        if (payload.startDateAt) finalizedPatch.startDateAt = new Date(payload.startDateAt);
        if (payload.notes !== undefined) finalizedPatch.notes = payload.notes;
        if (Object.keys(finalizedPatch).length > 0) {
          await tx.leadFinalized.update({ where: { id: finalized.id }, data: finalizedPatch });
        }

        // Upsert holder
        if (payload.holder !== undefined) {
          if (payload.holder === null) {
            await tx.leadFinalizedHolder.deleteMany({ where: { leadFinalizedId: finalized.id } });
          } else {
            await tx.leadFinalizedHolder.upsert({
              where: { leadFinalizedId: finalized.id },
              create: {
                leadFinalizedId: finalized.id,
                name: payload.holder.name,
                birthDate: new Date(payload.holder.birthDate),
                document: payload.holder.document,
                cnpj: payload.holder.cnpj ?? null,
              },
              update: {
                name: payload.holder.name,
                birthDate: new Date(payload.holder.birthDate),
                document: payload.holder.document,
                cnpj: payload.holder.cnpj ?? null,
              },
            });
          }
        }

        // Sync dependents
        if (payload.dependents !== undefined) {
          const existingIds = new Set(finalized.dependents.map((d) => d.id));
          const payloadIds = new Set(payload.dependents.filter((d) => d.id).map((d) => d.id!));

          const toDelete = [...existingIds].filter((id) => !payloadIds.has(id));
          if (toDelete.length > 0) {
            await tx.leadFinalizedDependent.deleteMany({ where: { id: { in: toDelete } } });
          }

          for (const dep of payload.dependents) {
            const depData = {
              name: dep.name,
              birthDate: new Date(dep.birthDate),
              parentesco: dep.parentesco,
              document: dep.document ?? null,
            };
            if (dep.id && existingIds.has(dep.id)) {
              await tx.leadFinalizedDependent.update({ where: { id: dep.id }, data: depData });
            } else {
              await tx.leadFinalizedDependent.create({
                data: { leadFinalizedId: finalized.id, ...depData },
              });
            }
          }
        }
      }
    });

    return this.fetchDetailResult(leadId);
  }

  async updatePortfolioEntry(
    leadId: string,
    teamId: string,
    profileId: string,
    isManager: boolean,
    isCloser: boolean,
    data: UpdatePortfolioData
  ): Promise<PortfolioRow> {
    const entry = await prisma.leadPortfolio.findUnique({
      where: { leadId },
      include: leadInclude,
    });

    if (!entry || entry.teamId !== teamId) {
      throw new Error('Entrada de carteira não encontrada ou sem permissão');
    }

    if (isCloser && !isManager && entry.lead.closerId !== profileId) {
      throw new Error('Acesso negado: você só pode editar leads da sua própria carteira');
    }

    const updated = await prisma.leadPortfolio.update({
      where: { leadId },
      data: {
        ...(data.portfolioStatus !== undefined ? { portfolioStatus: data.portfolioStatus } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.lastContactAt !== undefined ? { lastContactAt: data.lastContactAt } : {}),
      },
      include: leadInclude,
    });

    return mapToPortfolioRow(updated);
  }
}

export const portfolioService = new PortfolioService();
