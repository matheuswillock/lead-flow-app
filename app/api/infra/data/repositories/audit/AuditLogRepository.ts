import { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { AuditLogEntry, IAuditLogRepository } from "./IAuditLogRepository";

function toJsonInput(value: unknown | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) return Prisma.JsonNull;
  // Normaliza tipos não serializáveis nativamente em JSON (ex.: Date) antes de
  // gravar no campo Json do Prisma, que exige um InputJsonValue puro.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class AuditLogRepository implements IAuditLogRepository {
  async create(entry: AuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        actorProfileId: entry.actorProfileId,
        before: toJsonInput(entry.before),
        after: toJsonInput(entry.after),
        metadata: toJsonInput(entry.metadata),
      },
      select: { id: true },
    });
  }
}
