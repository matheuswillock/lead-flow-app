import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { IBackofficeDatabaseBackupExportRepository } from "./IBackofficeDatabaseBackupExportRepository"

const PAGE_SIZE = 10_000

type FindManyDelegate = {
  findMany: (args: {
    take: number
    skip: number
    orderBy: Record<string, "asc"> | Array<Record<string, "asc">>
  }) => Promise<unknown[]>
}

function orderByForModel(model: (typeof Prisma.dmmf.datamodel.models)[number]) {
  const idField = model.fields.find((f) => f.isId)?.name
  if (idField) return { [idField]: "asc" as const }

  const pkFields = model.primaryKey?.fields
  if (pkFields && pkFields.length > 0) {
    return pkFields.map((field) => ({ [field]: "asc" as const }))
  }

  return null
}

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

          const orderBy = orderByForModel(model)
          if (!orderBy) {
            throw new Error(
              `Backup incompleto: modelo ${model.name} sem chave para paginação estável`
            )
          }

          const delegateName =
            model.name.charAt(0).toLowerCase() + model.name.slice(1)

          const delegate = (
            tx as unknown as Record<string, FindManyDelegate>
          )[delegateName]

          const rows: unknown[] = []
          let skip = 0
          for (;;) {
            const page = await delegate.findMany({
              take: PAGE_SIZE,
              skip,
              orderBy,
            })
            rows.push(...page)
            if (page.length < PAGE_SIZE) break
            skip += PAGE_SIZE
          }

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
