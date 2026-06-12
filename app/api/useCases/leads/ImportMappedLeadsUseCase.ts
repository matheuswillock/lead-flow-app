import { Output } from "@/lib/output";
import { invalidateTeamLeadsCache } from "@/lib/cache/invalidation";
import { healthPlanService } from "@/app/api/services/healthPlans/HealthPlanService";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import type { ILeadRepository } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import {
  isLostStatus,
  mapHealthPlan,
  mapStatus,
  normalizeDigits,
  normalizeEmail,
  parseCurrency,
  parseImportDate,
} from "@/lib/leadImport/normalizers";
import type { MappedImportRow } from "@/app/api/v1/leads/import/mapped/DTO/mappedImportRequest";
import type { ILeadUseCase } from "./ILeadUseCase";
import { LeadUseCase } from "./LeadUseCase";

export interface ImportMappedLeadsContext {
  supabaseId: string;
  teamId: string;
}

export interface ImportMappedLeadsResult {
  created: number;
  createdWithDefaultStatus: number;
  skipped: number;
  sanitized: number;
  errors: string[];
}

export interface IImportMappedLeadsUseCase {
  execute(ctx: ImportMappedLeadsContext, rows: MappedImportRow[]): Promise<Output>;
}

export class ImportMappedLeadsUseCase implements IImportMappedLeadsUseCase {
  constructor(
    private readonly leadUseCase: ILeadUseCase,
    private readonly leadRepository: ILeadRepository
  ) {}

  async execute(ctx: ImportMappedLeadsContext, rows: MappedImportRow[]): Promise<Output> {
    const healthPlanOptions = await healthPlanService.listOptions();
    const healthPlanOptionNameByNormalized = new Map(
      healthPlanOptions.map((option) => [option.normalizedName, option.name])
    );

    const emails = new Set<string>();
    const cnpjs = new Set<string>();

    rows.forEach((row) => {
      const email = row.email ? normalizeEmail(row.email) : "";
      const cnpj = row.cnpj ? normalizeDigits(row.cnpj) : "";
      if (email) emails.add(email);
      if (cnpj) cnpjs.add(cnpj);
    });

    const existingLeads = await this.leadRepository.findImportConflicts(
      ctx.teamId,
      Array.from(emails),
      Array.from(cnpjs)
    );

    const existingByEmail = new Map<string, (typeof existingLeads)[number]>();
    const existingByCnpj = new Map<string, (typeof existingLeads)[number]>();

    existingLeads.forEach((lead) => {
      if (lead.email) existingByEmail.set(normalizeEmail(lead.email), lead);
      if (lead.cnpj) existingByCnpj.set(normalizeDigits(lead.cnpj), lead);
    });

    let created = 0;
    let createdWithDefaultStatus = 0;
    let skipped = 0;
    let sanitized = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const name = row.name?.trim() ?? "";
      const phone = row.phone?.trim() ?? "";
      if (!name || !phone) {
        skipped += 1;
        continue;
      }

      let email = row.email ? normalizeEmail(row.email) : "";
      let cnpj = row.cnpj ? normalizeDigits(row.cnpj) : "";
      const status = mapStatus(row.status);
      const currentHealthPlan = mapHealthPlan(row.currentHealthPlan, healthPlanOptionNameByNormalized);
      const currentValue = row.currentValue ? parseCurrency(row.currentValue) : undefined;
      const ticket = row.ticket ? parseCurrency(row.ticket) : undefined;
      const contractDueDate = row.contractDueDate ? parseImportDate(row.contractDueDate) : undefined;

      const emailConflict = email ? existingByEmail.get(email) : null;
      const cnpjConflict = cnpj ? existingByCnpj.get(cnpj) : null;

      const canReuseEmail = emailConflict && isLostStatus(emailConflict.status) && isLostStatus(status);
      const canReuseCnpj = cnpjConflict && isLostStatus(cnpjConflict.status) && isLostStatus(status);

      if ((emailConflict && !canReuseEmail) || (cnpjConflict && !canReuseCnpj)) {
        skipped += 1;
        continue;
      }

      if (emailConflict && canReuseEmail) {
        email = "";
        sanitized += 1;
      }
      if (cnpjConflict && canReuseCnpj) {
        cnpj = "";
        sanitized += 1;
      }

      const output = await this.leadUseCase.createLeadFromImport(
        ctx.supabaseId,
        {
          name,
          email: email || undefined,
          phone: phone || undefined,
          cnpj: cnpj || undefined,
          age: row.age?.trim() || undefined,
          currentHealthPlan: currentHealthPlan || undefined,
          currentValue: currentValue ?? undefined,
          referenceHospital: row.referenceHospital?.trim() || undefined,
          currentTreatment: row.currentTreatment?.trim() || undefined,
          notes: row.notes?.trim() || undefined,
          status,
          meetingHeald: undefined,
          closerId: undefined,
          meetingDate: undefined,
          meetingTitle: undefined,
          meetingNotes: undefined,
          meetingLink: undefined,
          assignedTo: undefined,
          ticket: ticket ?? undefined,
          contractDueDate,
          soldPlan: row.soldPlan?.trim() || undefined,
        },
        ctx.teamId
      );

      if (!output.isValid) {
        skipped += 1;
        if (output.errorMessages?.[0]) {
          errors.push(output.errorMessages[0]);
        }
        continue;
      }

      created += 1;
      const statusFellBackToDefault =
        status === "new_opportunity" && (row.status?.trim() ?? "") !== "new_opportunity";
      if (statusFellBackToDefault) {
        createdWithDefaultStatus += 1;
      }

      if (email) {
        existingByEmail.set(email, { id: "", email, cnpj, status });
      }
      if (cnpj) {
        existingByCnpj.set(cnpj, { id: "", email, cnpj, status });
      }
    }

    if (created > 0) {
      invalidateTeamLeadsCache({ teamId: ctx.teamId });
    }

    const result: ImportMappedLeadsResult = {
      created,
      createdWithDefaultStatus,
      skipped,
      sanitized,
      errors: errors.slice(0, 10),
    };

    return new Output(true, ["Importação concluída"], [], result);
  }
}

// Singleton export
export const importMappedLeadsUseCase = new ImportMappedLeadsUseCase(
  new LeadUseCase(leadRepository, new RegisterNewUserProfile()),
  leadRepository
);
