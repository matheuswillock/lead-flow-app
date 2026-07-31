import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { IBackofficeDatabaseBackupExportRepository } from "./IBackofficeDatabaseBackupExportRepository"

const MAX_ROWS_PER_TABLE = 100_000

export class BackofficeDatabaseBackupExportRepository
  implements IBackofficeDatabaseBackupExportRepository
{
  async exportSnapshot(): Promise<Map<string, string>> {
    const snapshot = new Map<string, string>()
    const models = Prisma.dmmf.datamodel.models

    await prisma.$transaction(
      async (tx) => {
        for (const model of models) {
          const hasBytesField = model.fields.some((f) => f.type === "Bytes")
          if (hasBytesField) continue

          const delegateName =
            model.name.charAt(0).toLowerCase() + model.name.slice(1)

          const rows = await (
            tx as unknown as Record<
              string,
              { findMany: (args: { take: number }) => Promise<unknown[]> }
            >
          )[delegateName].findMany({ take: MAX_ROWS_PER_TABLE })

          snapshot.set(
            model.name,
            JSON.stringify(rows, (_key, value) =>
              typeof value === "bigint" ? value.toString() : value
            )
          )
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 280_000,
      }
    )

    return snapshot
  }
}
