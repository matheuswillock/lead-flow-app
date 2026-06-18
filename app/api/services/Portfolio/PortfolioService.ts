import { ActivityType, ContractType, LeadStatus, Prisma, PortfolioSource, RenewalStatus } from '@prisma/client';
import { prisma } from '@/app/api/infra/data/prisma';
import { sanitizeDocumentDigits, sanitizeRgCpfDigits } from '@/lib/masks';
import type {
  CreatePortfolioEntryPayload,
  CreatePortfolioImportEntryPayload,
  IPortfolioService,
  PortfolioDetailResult,
  PortfolioFilters,
  PortfolioImportConflictLead,
  PortfolioImportTarget,
  PortfolioListResult,
  PortfolioRow,
  UpdatePortfolioData,
  UpdatePortfolioDetailPayload,
} from './IPortfolioService';

function mapToPortfolioRow(entry: {
  id: string;
  portfolioStatus: string;
  renewalStatus: RenewalStatus;
  renewalAmount: { toNumber(): number } | null;
  source: PortfolioSource;
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
    LeadFinalized: { operadora: string | null; startDateAt: Date; contractType: ContractType; holder: { razaoSocial: string | null } | null }[];
  };
}): PortfolioRow {
  const ticket = entry.lead.ticket ? entry.lead.ticket.toNumber() : 0;
  const currentValue = entry.lead.currentValue ? entry.lead.currentValue.toNumber() : 0;
  const finalized = entry.lead.LeadFinalized[0] ?? null;
  const displayName =
    finalized?.contractType === ContractType.corporate && finalized.holder?.razaoSocial
      ? finalized.holder.razaoSocial
      : entry.lead.name;
  return {
    portfolioId: entry.id,
    leadId: entry.lead.id,
    leadCode: entry.lead.leadCode,
    leadName: displayName,
    source: entry.source,
    portfolioStatus: entry.portfolioStatus as PortfolioRow['portfolioStatus'],
    renewalStatus: entry.renewalStatus,
    renewalAmount: entry.renewalAmount ? entry.renewalAmount.toNumber() : null,
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
        select: { operadora: true, startDateAt: true, contractType: true, holder: { select: { razaoSocial: true } } },
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
      portfolioStatuses, sdrIds, closerIds, sources,
      operadoras,
      contractDateStart, contractDateEnd,
      dueDateStart, dueDateEnd,
      documentSearch,
      search,
      page, pageSize,
    } = filters;

    const needsLeadFinalizedJoin = contractDateStart || contractDateEnd || documentSearch || operadoras?.length;

    const accessLeadFilter = {
      ...(isCloser && !isManager ? { closerId: profileId } : {}),
    };

    const where: Prisma.LeadPortfolioWhereInput = {
      teamId,
      ...(portfolioStatuses?.length ? { portfolioStatus: { in: portfolioStatuses } } : {}),
      ...(sources?.length ? { source: { in: sources } } : {}),
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
                ...(operadoras?.length ? [{
                  operadora: { in: operadoras },
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

    // Janela de renovação: vencimento já vencido ou em até 90 dias (todos os matches, sem paginação).
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const dueSoonLimit = new Date(now);
    dueSoonLimit.setDate(dueSoonLimit.getDate() + 90);

    const existingLeadWhere = where.lead as Prisma.LeadWhereInput;
    const existingDueDateBounds = existingLeadWhere.contractDueDate as Record<string, unknown> | undefined;
    const renewalWhere: Prisma.LeadPortfolioWhereInput = {
      ...where,
      lead: {
        ...existingLeadWhere,
        contractDueDate: { ...existingDueDateBounds, not: null, lte: dueSoonLimit },
      },
    };

    const [totalRows, entries, operadoraRecords, statsRows, renewalEntries] = await Promise.all([
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
      // Agregados de todos os matches (não apenas a página atual).
      prisma.leadPortfolio.findMany({
        where,
        select: {
          portfolioStatus: true,
          lead: { select: { ticket: true, currentValue: true, contractDueDate: true } },
        },
      }),
      // Renovações completas de todos os matches dentro da janela.
      prisma.leadPortfolio.findMany({
        where: renewalWhere,
        include: leadInclude,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const availableOperadoras = operadoraRecords
      .map((r) => r.operadora!)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    let totalValue = 0;
    let activeCount = 0;
    let dueSoonCount = 0;
    for (const r of statsRows) {
      const ticket = r.lead.ticket ? r.lead.ticket.toNumber() : 0;
      const currentValue = r.lead.currentValue ? r.lead.currentValue.toNumber() : 0;
      totalValue += ticket > 0 ? ticket : currentValue;
      if (r.portfolioStatus === 'active') activeCount += 1;
      const due = r.lead.contractDueDate;
      if (due && due >= todayStart && due <= dueSoonLimit) dueSoonCount += 1;
    }

    return {
      rows: entries.map(mapToPortfolioRow),
      renewals: renewalEntries.map(mapToPortfolioRow),
      stats: {
        totalClients: totalRows,
        totalValue,
        activeCount,
        dueSoonCount,
      },
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

    const detailDisplayName =
      finalized?.contractType === ContractType.corporate && finalized.holder?.razaoSocial
        ? finalized.holder.razaoSocial
        : entry.lead.name;

    return {
      portfolioId: entry.id,
      leadId: entry.lead.id,
      leadCode: entry.lead.leadCode,
      leadName: detailDisplayName,
      source: entry.source,
      saleValue: ticket > 0 ? ticket : currentValue,
      portfolioStatus: entry.portfolioStatus,
      sdr: entry.lead.assignee ? { id: entry.lead.assignee.id, name: entry.lead.assignee.fullName ?? '' } : null,
      closer: entry.lead.closer ? { id: entry.lead.closer.id, name: entry.lead.closer.fullName ?? '' } : null,
      soldPlan: entry.lead.soldPlan,
      contractDueDate: entry.lead.contractDueDate,
      contractType: finalized?.contractType ?? ContractType.individual,
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
            razaoSocial: finalized.holder.razaoSocial ?? null,
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

  private async generateLeadCode(name: string): Promise<string> {
    const clean = name.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const firstLetter = (clean[0] || 'L').toUpperCase();
    const lastLetter = (clean[clean.length - 1] || 'D').toUpperCase();

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const digitsLength = 4 + Math.floor(Math.random() * 3);
      const digits = Array.from({ length: digitsLength }, () => Math.floor(Math.random() * 10)).join('');
      const code = `${firstLetter}${digits}${lastLetter}`;
      const existing = await prisma.lead.findUnique({ where: { leadCode: code }, select: { id: true } });
      if (!existing) {
        return code;
      }
    }

    const fallbackDigits = Date.now().toString().slice(-6);
    return `${firstLetter}${fallbackDigits}${lastLetter}`;
  }

  async createPortfolioEntry(
    teamId: string,
    profileId: string,
    data: CreatePortfolioEntryPayload
  ): Promise<PortfolioDetailResult> {
    const startDateAt = new Date(data.startDateAt);
    const finalizedDateAt = new Date(data.finalizedDateAt);
    const holderBirthDate = new Date(data.holder.birthDate);
    const contractDueDate = data.contractDueDate ? new Date(data.contractDueDate) : null;

    if (Number.isNaN(startDateAt.getTime())) {
      throw new Error('Data de início inválida');
    }
    if (Number.isNaN(finalizedDateAt.getTime())) {
      throw new Error('Data de finalização inválida');
    }
    if (Number.isNaN(holderBirthDate.getTime())) {
      throw new Error('Data de nascimento do titular inválida');
    }
    if (contractDueDate && Number.isNaN(contractDueDate.getTime())) {
      throw new Error('Data de vigência inválida');
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true },
    });

    if (!team) {
      throw new Error('Time não encontrado');
    }

    const closerMember = await prisma.teamMember.findFirst({
      where: { teamId, profileId: data.closerId },
      select: { id: true },
    });

    if (!closerMember) {
      throw new Error('Closer inválido para este time');
    }

    const leadCode = await this.generateLeadCode(data.name);
    const amount = Number(data.amount);
    const created = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          managerId: team.masterId,
          teamId,
          leadCode,
          status: LeadStatus.contract_finalized,
          name: data.name.trim(),
          email: data.email.trim(),
          phone: data.phone.trim(),
          cnpj: sanitizeDocumentDigits(data.cnpj || '') || null,
          soldPlan: data.soldPlan?.trim() || null,
          contractDueDate,
          ticket: amount,
          currentValue: amount,
          createdBy: profileId,
          updatedBy: profileId,
          closerId: data.closerId,
          activities: {
            create: [
              {
                type: ActivityType.note,
                body: 'Lead criado direto na carteira',
                createdBy: profileId,
              },
              {
                type: ActivityType.status_change,
                body: `Contrato finalizado no valor de R$ ${amount.toFixed(2)}`,
                payload: {
                  previousStatus: LeadStatus.new_opportunity,
                  newStatus: LeadStatus.contract_finalized,
                  amount,
                  startDateAt: data.startDateAt,
                  finalizedDateAt: data.finalizedDateAt,
                },
                createdBy: profileId,
              },
            ],
          },
        },
      });

      const finalized = await tx.leadFinalized.create({
        data: {
          leadId: lead.id,
          amount,
          startDateAt,
          finalizedDateAt,
          duration: Math.max(
            0,
            Math.floor(
              (finalizedDateAt.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          ),
          contractType: data.contractType,
          notes: data.notes?.trim() || null,
          closerId: data.closerId,
          operadora: data.operadora.trim(),
          productName: data.productName?.trim() || null,
        },
      });

      await tx.leadFinalizedHolder.create({
        data: {
          leadFinalizedId: finalized.id,
          name: data.holder.name.trim(),
          razaoSocial: data.holder.razaoSocial?.trim() || null,
          birthDate: holderBirthDate,
          document: sanitizeRgCpfDigits(data.holder.document || ''),
          cnpj: sanitizeDocumentDigits(data.holder.cnpj || '') || null,
        },
      });

      const dependents = data.dependents ?? [];
      if (dependents.length > 0) {
        await tx.leadFinalizedDependent.createMany({
          data: dependents.map((dep) => ({
            leadFinalizedId: finalized.id,
            name: dep.name.trim(),
            birthDate: new Date(dep.birthDate),
            parentesco: dep.parentesco.trim(),
            document: sanitizeRgCpfDigits(dep.document || '') || null,
          })),
        });
      }

      await tx.leadPortfolio.create({
        data: {
          leadId: lead.id,
          teamId,
          portfolioStatus: 'active',
          source: data.source,
        },
      });

      return lead;
    });

    return this.fetchDetailResult(created.id);
  }

  async getImportTarget(teamId: string, closerId: string): Promise<PortfolioImportTarget> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { masterId: true },
    });

    if (!team) {
      throw new Error('Time não encontrado');
    }

    const closerMember = await prisma.teamMember.findFirst({
      where: { teamId, profileId: closerId },
      select: { id: true },
    });

    if (!closerMember) {
      throw new Error('Closer inválido para este time');
    }

    return { masterId: team.masterId };
  }

  async findImportConflicts(
    teamId: string,
    emails: string[],
    cnpjs: string[]
  ): Promise<PortfolioImportConflictLead[]> {
    if (emails.length === 0 && cnpjs.length === 0) {
      return [];
    }

    const conditions: Prisma.LeadWhereInput[] = [];
    if (emails.length > 0) conditions.push({ email: { in: emails } });
    if (cnpjs.length > 0) conditions.push({ cnpj: { in: cnpjs } });

    return prisma.lead.findMany({
      where: { teamId, OR: conditions },
      select: { id: true, email: true, cnpj: true },
    });
  }

  async createPortfolioEntryFromImport(
    teamId: string,
    masterId: string,
    profileId: string,
    data: CreatePortfolioImportEntryPayload
  ): Promise<string> {
    const leadCode = await this.generateLeadCode(data.name);
    const amount = Number(data.amount);

    const created = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          managerId: masterId,
          teamId,
          leadCode,
          status: LeadStatus.contract_finalized,
          name: data.name.trim(),
          email: data.email?.trim() || null,
          phone: data.phone.trim(),
          cnpj: sanitizeDocumentDigits(data.cnpj || '') || null,
          contractDueDate: data.contractDueDate ?? null,
          ticket: amount,
          currentValue: amount,
          createdBy: profileId,
          updatedBy: profileId,
          closerId: data.closerId,
          activities: {
            create: [
              {
                type: ActivityType.note,
                body: 'Cliente criado via importação manual na carteira',
                payload: { source: 'import_manual' },
                createdBy: profileId,
              },
              {
                type: ActivityType.status_change,
                body: `Contrato finalizado no valor de R$ ${amount.toFixed(2)}`,
                payload: {
                  previousStatus: LeadStatus.new_opportunity,
                  newStatus: LeadStatus.contract_finalized,
                  amount,
                  startDateAt: data.startDateAt.toISOString(),
                  finalizedDateAt: data.finalizedDateAt.toISOString(),
                },
                createdBy: profileId,
              },
            ],
          },
        },
      });

      const finalized = await tx.leadFinalized.create({
        data: {
          leadId: lead.id,
          amount,
          startDateAt: data.startDateAt,
          finalizedDateAt: data.finalizedDateAt,
          duration: 0,
          contractType: data.contractType ?? ContractType.individual,
          notes: data.notes?.trim() || null,
          closerId: data.closerId,
          operadora: data.operadora.trim(),
          productName: data.productName?.trim() || null,
        },
      });

      if (data.holder) {
        await tx.leadFinalizedHolder.create({
          data: {
            leadFinalizedId: finalized.id,
            name: data.holder.name.trim(),
            razaoSocial: data.holder.razaoSocial?.trim() || null,
            birthDate: data.holder.birthDate,
            document: sanitizeRgCpfDigits(data.holder.document),
          },
        });
      }

      await tx.leadPortfolio.create({
        data: {
          leadId: lead.id,
          teamId,
          portfolioStatus: 'active',
          source: data.source,
        },
      });

      return lead;
    });

    return created.id;
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
        if (payload.contractType !== undefined) finalizedPatch.contractType = payload.contractType;
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
                razaoSocial: payload.holder.razaoSocial ?? null,
                birthDate: new Date(payload.holder.birthDate),
                document: payload.holder.document ?? '',
                cnpj: payload.holder.cnpj ?? null,
              },
              update: {
                name: payload.holder.name,
                razaoSocial: payload.holder.razaoSocial ?? null,
                birthDate: new Date(payload.holder.birthDate),
                document: payload.holder.document ?? '',
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

    const willRenew = data.renewalStatus === 'renewed';
    const effectiveRenewalAmount =
      data.renewalAmount !== undefined && data.renewalAmount !== null
        ? data.renewalAmount
        : entry.renewalAmount
          ? entry.renewalAmount.toNumber()
          : null;

    await prisma.$transaction(async (tx) => {
      await tx.leadPortfolio.update({
        where: { leadId },
        data: {
          ...(data.portfolioStatus !== undefined ? { portfolioStatus: data.portfolioStatus } : {}),
          ...(data.renewalStatus !== undefined ? { renewalStatus: data.renewalStatus } : {}),
          ...(data.renewalAmount !== undefined ? { renewalAmount: data.renewalAmount } : {}),
          ...(data.note !== undefined ? { note: data.note } : {}),
          ...(data.lastContactAt !== undefined ? { lastContactAt: data.lastContactAt } : {}),
          // Ao renovar, o novo valor é aplicado ao contrato e o renewalAmount é consumido.
          ...(willRenew ? { renewalAmount: null } : {}),
        },
      });

      if (willRenew && effectiveRenewalAmount && effectiveRenewalAmount > 0) {
        await tx.lead.update({
          where: { id: leadId },
          data: { ticket: effectiveRenewalAmount, currentValue: effectiveRenewalAmount },
        });
      }
    });

    const updated = await prisma.leadPortfolio.findUnique({
      where: { leadId },
      include: leadInclude,
    });

    if (!updated) {
      throw new Error('Entrada de carteira não encontrada ou sem permissão');
    }

    return mapToPortfolioRow(updated);
  }
}

export const portfolioService = new PortfolioService();
