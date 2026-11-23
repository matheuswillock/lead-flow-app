import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { IPlanCatalogRepository, PlanCatalogImportMeta } from "@/lib/planCatalog/importPlanCatalog"
import type { PlanCatalogRows } from "@/lib/planCatalog/planCatalogTransform"

// Limite de parâmetros do Postgres: lotes pequenos por número de colunas.
const BATCH = { tables: 500, networkEntries: 4000, providers: 1000, ruleTexts: 1000 }

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export class PrismaPlanCatalogRepository implements IPlanCatalogRepository {
  async replaceCatalog(rows: PlanCatalogRows, meta: PlanCatalogImportMeta): Promise<void> {
    await prisma.$transaction(
      async (tx) => {
        // Ordem respeita as FKs: rede -> provedores; tabelas -> operadoras.
        await tx.healthPlanNetworkEntry.deleteMany()
        await tx.healthPlanTable.deleteMany()
        await tx.healthPlanProvider.deleteMany()
        await tx.healthPlanRuleText.deleteMany()
        await tx.healthPlanOperator.deleteMany()

        await tx.healthPlanOperator.createMany({ data: rows.operators })
        const operators = await tx.healthPlanOperator.findMany({ select: { id: true, name: true } })
        const operatorId = new Map(operators.map((o) => [o.name, o.id]))

        for (const batch of chunks(rows.ruleTexts, BATCH.ruleTexts)) {
          await tx.healthPlanRuleText.createMany({ data: batch })
        }
        for (const batch of chunks(rows.providers, BATCH.providers)) {
          await tx.healthPlanProvider.createMany({ data: batch })
        }
        for (const batch of chunks(rows.tables, BATCH.tables)) {
          await tx.healthPlanTable.createMany({
            data: batch.map((t) => {
              const { operatorName, precos, regras, ...rest } = t
              return {
                ...rest,
                operatorId: operatorId.get(operatorName)!,
                precos: precos as Prisma.InputJsonValue,
                regras: regras as Prisma.InputJsonValue,
              }
            }),
          })
        }
        for (const batch of chunks(rows.networkEntries, BATCH.networkEntries)) {
          await tx.healthPlanNetworkEntry.createMany({ data: batch })
        }

        await tx.healthPlanCatalogImport.create({
          data: {
            source: meta.source,
            generatedAt: meta.generatedAt,
            counts: meta.counts as Prisma.InputJsonValue,
          },
        })
      },
      { timeout: 600_000, maxWait: 30_000 },
    )
  }
}
