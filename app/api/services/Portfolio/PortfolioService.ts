import { Prisma } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import type {
  IPortfolioService,
  PortfolioFilters,
  PortfolioListResult,
  PortfolioRow,
  UpdatePortfolioData,
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
  };
}): PortfolioRow {
  const ticket = entry.lead.ticket ? entry.lead.ticket.toNumber() : 0;
  const currentValue = entry.lead.currentValue ? entry.lead.currentValue.toNumber() : 0;
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
    },
  },
} satisfies Prisma.LeadPortfolioInclude;

export class PortfolioService implements IPortfolioService {
  async listPortfolio(filters: PortfolioFilters): Promise<PortfolioListResult> {
    const { teamId, profileId, isManager, isCloser, portfolioStatus, sdrId, closerId, search, page, pageSize } = filters;

    const where: Prisma.LeadPortfolioWhereInput = {
      teamId,
      ...(portfolioStatus ? { portfolioStatus } : {}),
      lead: {
        ...(isCloser && !isManager ? { closerId: profileId } : {}),
        ...(sdrId ? { assignedTo: sdrId } : {}),
        ...(closerId && (isManager || !isCloser) ? { closerId } : {}),
        ...(search ? { name: { contains: search, mode: Prisma.QueryMode.insensitive } } : {}),
      },
    };

    const [totalRows, entries] = await Promise.all([
      prisma.leadPortfolio.count({ where }),
      prisma.leadPortfolio.findMany({
        where,
        include: leadInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      rows: entries.map(mapToPortfolioRow),
      pagination: {
        page,
        pageSize,
        totalRows,
        totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
      },
    };
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

    // CLOSER can only update their own leads
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
