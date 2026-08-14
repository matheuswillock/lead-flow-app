import { Output } from "@/lib/output";
import {
  normalizeDigits,
  normalizeEmail,
  parseCurrency,
  parseImportDate,
} from "@/lib/leadImport/normalizers";
import { portfolioService } from "@/app/api/services/Portfolio/PortfolioService";
import type { IPortfolioService } from "@/app/api/services/Portfolio/IPortfolioService";
import { syncFinalizedToRadarInlineBatch } from "@/app/api/useCases/radar/syncFinalizedToRadarInline";
import type {
  MappedPortfolioImportRequest,
  MappedPortfolioImportRow,
} from "@/app/api/v1/portfolio/import/mapped/DTO/mappedPortfolioImportRequest";

export interface ImportMappedPortfolioClientsContext {
  teamId: string;
  profileId: string;
}

export interface PortfolioImportRowIssue {
  line: number | null;
  name: string;
  reason: string;
}

export interface ImportMappedPortfolioClientsResult {
  created: number;
  skipped: number;
  errors: string[];
  issues: PortfolioImportRowIssue[];
}

export interface IImportMappedPortfolioClientsUseCase {
  execute(
    ctx: ImportMappedPortfolioClientsContext,
    input: MappedPortfolioImportRequest
  ): Promise<Output>;
}

const parseImportDateValue = (value: string | undefined): Date | null => {
  if (!value) return null;
  const iso = parseImportDate(value);
  return iso ? new Date(iso) : null;
};

export class ImportMappedPortfolioClientsUseCase implements IImportMappedPortfolioClientsUseCase {
  constructor(private readonly portfolioService: IPortfolioService) {}

  async execute(
    ctx: ImportMappedPortfolioClientsContext,
    input: MappedPortfolioImportRequest
  ): Promise<Output> {
    let target: { masterId: string };
    try {
      target = await this.portfolioService.getImportTarget(ctx.teamId, input.closerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível validar o time";
      return new Output(false, [], [message], null);
    }

    const emails = new Set<string>();
    const cnpjs = new Set<string>();
    input.rows.forEach((row) => {
      const email = row.email ? normalizeEmail(row.email) : "";
      const cnpj = row.cnpj ? normalizeDigits(row.cnpj) : "";
      if (email) emails.add(email);
      if (cnpj) cnpjs.add(cnpj);
    });

    const existingLeads = await this.portfolioService.findImportConflicts(
      ctx.teamId,
      Array.from(emails),
      Array.from(cnpjs)
    );

    const existingEmails = new Set<string>();
    const existingCnpjs = new Set<string>();
    existingLeads.forEach((lead) => {
      if (lead.email) existingEmails.add(normalizeEmail(lead.email));
      if (lead.cnpj) existingCnpjs.add(normalizeDigits(lead.cnpj));
    });

    let created = 0;
    const importedLeadIds: string[] = [];
    let skipped = 0;
    const errors: string[] = [];
    const issues: PortfolioImportRowIssue[] = [];

    const skipRow = (row: MappedPortfolioImportRow, name: string, reason: string) => {
      skipped += 1;
      issues.push({ line: row.line ?? null, name, reason });
    };

    for (const row of input.rows) {
      const name = row.name?.trim() ?? "";
      const phone = row.phone?.trim() ?? "";
      const operadora = row.operadora?.trim() ?? "";
      const amount = row.amount ? parseCurrency(row.amount) : undefined;
      const startDateAt = parseImportDateValue(row.startDateAt);

      if (!name || !phone) {
        skipRow(row, name || "(sem nome)", "Linha sem nome ou telefone");
        continue;
      }
      if (!operadora) {
        skipRow(row, name, "Linha sem operadora");
        continue;
      }
      if (!amount || amount <= 0) {
        skipRow(row, name, "Valor do contrato ausente ou inválido");
        continue;
      }
      if (!startDateAt) {
        skipRow(row, name, "Data de início do contrato ausente ou inválida");
        continue;
      }

      const email = row.email ? normalizeEmail(row.email) : "";
      const cnpj = row.cnpj ? normalizeDigits(row.cnpj) : "";

      if (email && existingEmails.has(email)) {
        skipRow(row, name, "Já existe um cliente no time com o mesmo e-mail");
        continue;
      }
      if (cnpj && existingCnpjs.has(cnpj)) {
        skipRow(row, name, "Já existe um cliente no time com o mesmo CNPJ");
        continue;
      }

      const finalizedDateAt = parseImportDateValue(row.finalizedDateAt) ?? startDateAt;
      const contractDueDate = parseImportDateValue(row.contractDueDate);
      const holderName = row.holderName?.trim() ?? "";
      const holderBirthDate = parseImportDateValue(row.holderBirthDate);
      const holderDocument = row.holderDocument?.trim() ?? "";
      const holder =
        holderName && holderBirthDate && holderDocument
          ? { name: holderName, birthDate: holderBirthDate, document: holderDocument }
          : null;
      const rowContractType = row.contractType ?? 'individual';

      try {
        const leadId = await this.portfolioService.createPortfolioEntryFromImport(
          ctx.teamId,
          target.masterId,
          ctx.profileId,
          {
            name,
            email: email || null,
            phone,
            cnpj: cnpj || null,
            source: input.source,
            contractType: rowContractType as 'individual' | 'corporate' | 'adhesion',
            amount,
            startDateAt,
            finalizedDateAt,
            contractDueDate,
            closerId: input.closerId,
            operadora,
            productName: row.productName?.trim() || null,
            notes: row.notes?.trim() || null,
            holder,
          }
        );
        importedLeadIds.push(leadId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível criar o cliente";
        skipRow(row, name, message);
        errors.push(message);
        continue;
      }

      created += 1;
      if (email) existingEmails.add(email);
      if (cnpj) existingCnpjs.add(cnpj);
    }

    await syncFinalizedToRadarInlineBatch({ teamId: ctx.teamId, leadIds: importedLeadIds });

    const result: ImportMappedPortfolioClientsResult = {
      created,
      skipped,
      errors: errors.slice(0, 10),
      issues,
    };

    return new Output(true, ["Importação concluída"], [], result);
  }
}

// Singleton export
export const importMappedPortfolioClientsUseCase = new ImportMappedPortfolioClientsUseCase(
  portfolioService
);
