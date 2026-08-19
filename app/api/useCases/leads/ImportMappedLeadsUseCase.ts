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
import { evaluateEmailForAudience } from "@/lib/email/audience-prevalidation";
import { findTeamBlocklistedEmails } from "@/lib/email/email-contact-blocklist";
import type { MappedImportRow } from "@/app/api/v1/leads/import/mapped/DTO/mappedImportRequest";
import type { ILeadUseCase } from "./ILeadUseCase";
import { LeadUseCase } from "./LeadUseCase";
import { leadDuplicateCheckService } from "@/app/api/services/leadDuplicateCheck/LeadDuplicateCheckService";

export interface ImportMappedLeadsContext {
  supabaseId: string;
  teamId: string;
}

export interface ImportRowIssue {
  line: number | null;
  name: string;
  kind: "not_imported" | "default_status" | "duplicate_detected" | "email_flagged";
  reason: string;
}

export interface ImportMappedLeadsResult {
  created: number;
  createdWithDefaultStatus: number;
  skipped: number;
  sanitized: number;
  errors: string[];
  issues: ImportRowIssue[];
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
    const blocklistedEmails = await findTeamBlocklistedEmails(ctx.teamId);

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
    const issues: ImportRowIssue[] = [];

    for (const row of rows) {
      const line = row.line ?? null;
      const name = row.name?.trim() ?? "";
      const phone = row.phone?.trim() ?? "";
      if (!name || !phone) {
        skipped += 1;
        issues.push({
          line,
          name: name || "(sem nome)",
          kind: "not_imported",
          reason: "Linha sem nome ou telefone",
        });
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
        issues.push({
          line,
          name,
          kind: "not_imported",
          reason:
            emailConflict && !canReuseEmail
              ? "Já existe um lead no time com o mesmo e-mail"
              : "Já existe um lead no time com o mesmo CNPJ",
        });
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

      const duplicateCandidates = await leadDuplicateCheckService.findCandidates(
        {
          profileId: "",
          teamMember: { role: "manager", functions: [] },
        },
        {
          teamId: ctx.teamId,
          phone,
          email: email || undefined,
        }
      );

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
          confirmDuplicate: true,
          originChannel: "csv_import",
        },
        ctx.teamId
      );

      if (!output.isValid) {
        skipped += 1;
        const reason = output.errorMessages?.[0] || "Não foi possível criar o lead";
        issues.push({ line, name, kind: "not_imported", reason });
        if (output.errorMessages?.[0]) {
          errors.push(output.errorMessages[0]);
        }
        continue;
      }

      created += 1;
      if (email) {
        const audience = evaluateEmailForAudience(email);
        if (!audience.ok) {
          issues.push({ line, name, kind: "email_flagged", reason: audience.reason });
        } else if (blocklistedEmails.has(email)) {
          issues.push({
            line,
            name,
            kind: "email_flagged",
            reason: "E-mail na lista de bloqueados",
          });
        }
      }
      if (duplicateCandidates.length > 0) {
        issues.push({
          line,
          name,
          kind: "duplicate_detected",
          reason: `Possível duplicado detectado (${duplicateCandidates
            .map((candidate) => candidate.leadCode)
            .join(", ")}) — lead importado mesmo assim`,
        });
      }
      const rawStatus = row.status?.trim() ?? "";
      const statusFellBackToDefault = status === "new_opportunity" && rawStatus !== "new_opportunity";
      if (statusFellBackToDefault) {
        createdWithDefaultStatus += 1;
        issues.push({
          line,
          name,
          kind: "default_status",
          reason: rawStatus
            ? `Status "${rawStatus}" sem mapeamento; importado como Nova oportunidade`
            : "Sem status no arquivo; importado como Nova oportunidade",
        });
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
      issues,
    };

    return new Output(true, ["Importação concluída"], [], result);
  }
}

// Singleton export
export const importMappedLeadsUseCase = new ImportMappedLeadsUseCase(
  new LeadUseCase(leadRepository, new RegisterNewUserProfile()),
  leadRepository
);
