import type { AuditAction, AuditEntityType } from "@prisma/client";

export interface AuditLogEntry {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorProfileId: string | null;
  before: unknown | null;
  after: unknown | null;
  metadata?: Record<string, unknown> | null;
}

export interface IAuditLogRepository {
  create(entry: AuditLogEntry): Promise<void>;
}

export interface AuditLogHistoryRow {
  createdAt: Date;
  actorProfileId: string | null;
  metadata: unknown;
}

export interface IAuditLogHistoryRepository {
  listByEntity(entityType: AuditEntityType, entityId: string, limit: number): Promise<AuditLogHistoryRow[]>;
}
