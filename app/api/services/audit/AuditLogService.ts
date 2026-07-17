import { AuditLogRepository } from "@/app/api/infra/data/repositories/audit/AuditLogRepository";
import type { AuditLogEntry, IAuditLogRepository } from "@/app/api/infra/data/repositories/audit/IAuditLogRepository";

export class AuditLogService {
  constructor(private readonly repository: IAuditLogRepository) {}

  async logAudit(entry: AuditLogEntry): Promise<void> {
    try {
      await this.repository.create(entry);
    } catch (error) {
      console.error(
        `[AuditLogService][logAudit] Erro ao gravar log de auditoria (entityType=${entry.entityType}, entityId=${entry.entityId}, action=${entry.action}, actorProfileId=${entry.actorProfileId}):`,
        error
      );
    }
  }
}

export const auditLogService = new AuditLogService(new AuditLogRepository());
