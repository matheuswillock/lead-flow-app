import { auditLogService } from "@/app/api/services/audit/AuditLogService";
import type { AuditLogEntry } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository";

export class AuditLogWriter {
  async logAudit(entry: AuditLogEntry): Promise<void> {
    await auditLogService.logAudit(entry);
  }
}

export const auditLogWriter = new AuditLogWriter();
