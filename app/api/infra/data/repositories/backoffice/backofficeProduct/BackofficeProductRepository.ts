import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeProductWithPaymentRules,
  CreateBackofficeProductInput,
  IBackofficeProductRepository,
  UpdateBackofficeProductInput,
  UpsertPaymentRuleInput,
} from "./IBackofficeProductRepository"
import type { BackofficeProduct } from "@prisma/client"

const paymentRulesInclude = { paymentRules: true } as const

function toDecimalOrNull(value: number | null | undefined): Prisma.Decimal | null {
  if (value == null) return null
  return new Prisma.Decimal(value)
}

export class BackofficeProductRepository implements IBackofficeProductRepository {
  async findAll(): Promise<BackofficeProduct[]> {
    return prisma.backofficeProduct.findMany({
      orderBy: [{ featureSlug: "asc" }, { isDefault: "desc" }, { name: "asc" }],
    })
  }

  async findAllWithPaymentRules(): Promise<BackofficeProductWithPaymentRules[]> {
    return prisma.backofficeProduct.findMany({
      orderBy: [{ featureSlug: "asc" }, { isDefault: "desc" }, { name: "asc" }],
      include: paymentRulesInclude,
    })
  }

  async findById(id: string): Promise<BackofficeProduct | null> {
    return prisma.backofficeProduct.findUnique({ where: { id } })
  }

  async findByIdWithPaymentRules(id: string): Promise<BackofficeProductWithPaymentRules | null> {
    return prisma.backofficeProduct.findUnique({
      where: { id },
      include: paymentRulesInclude,
    })
  }

  async findByFeatureSlug(featureSlug: string): Promise<BackofficeProduct[]> {
    return prisma.backofficeProduct.findMany({
      where: { featureSlug },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    })
  }

  async findByFeatureSlugWithPaymentRules(
    featureSlug: string
  ): Promise<BackofficeProductWithPaymentRules[]> {
    return prisma.backofficeProduct.findMany({
      where: { featureSlug, isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: paymentRulesInclude,
    })
  }

  async findDefaultByFeatureSlug(featureSlug: string): Promise<BackofficeProduct | null> {
    return prisma.backofficeProduct.findFirst({
      where: { featureSlug, isDefault: true, isActive: true },
    })
  }

  async findDefaultByFeatureSlugWithPaymentRules(
    featureSlug: string
  ): Promise<BackofficeProductWithPaymentRules | null> {
    return prisma.backofficeProduct.findFirst({
      where: { featureSlug, isDefault: true, isActive: true },
      include: paymentRulesInclude,
    })
  }

  async countByFeatureSlug(featureSlug: string): Promise<number> {
    return prisma.backofficeProduct.count({ where: { featureSlug } })
  }

  async create(data: CreateBackofficeProductInput): Promise<BackofficeProduct> {
    return prisma.backofficeProduct.create({
      data: {
        name: data.name,
        featureSlug: data.featureSlug,
        description: data.description ?? null,
        type: data.type,
        billingMode: data.billingMode,
        priceMonthly: toDecimalOrNull(data.priceMonthly),
        priceQuarterly: toDecimalOrNull(data.priceQuarterly),
        priceSemiannual: toDecimalOrNull(data.priceSemiannual),
        priceAnnual: toDecimalOrNull(data.priceAnnual),
        priceLifetime: toDecimalOrNull(data.priceLifetime),
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    })
  }

  async update(id: string, data: UpdateBackofficeProductInput): Promise<BackofficeProduct> {
    return prisma.backofficeProduct.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.featureSlug !== undefined && { featureSlug: data.featureSlug }),
        ...(Object.prototype.hasOwnProperty.call(data, "description") && {
          description: data.description ?? null,
        }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.billingMode !== undefined && { billingMode: data.billingMode }),
        ...(Object.prototype.hasOwnProperty.call(data, "priceMonthly") && {
          priceMonthly: toDecimalOrNull(data.priceMonthly),
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "priceQuarterly") && {
          priceQuarterly: toDecimalOrNull(data.priceQuarterly),
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "priceSemiannual") && {
          priceSemiannual: toDecimalOrNull(data.priceSemiannual),
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "priceAnnual") && {
          priceAnnual: toDecimalOrNull(data.priceAnnual),
        }),
        ...(Object.prototype.hasOwnProperty.call(data, "priceLifetime") && {
          priceLifetime: toDecimalOrNull(data.priceLifetime),
        }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async clearDefaultForFeatureSlug(featureSlug: string, exceptId?: string): Promise<void> {
    await prisma.backofficeProduct.updateMany({
      where: {
        featureSlug,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    })
  }

  async upsertPaymentRules(productId: string, rules: UpsertPaymentRuleInput[]): Promise<void> {
    await prisma.$transaction(
      rules.map((rule) =>
        prisma.backofficeProductPaymentRule.upsert({
          where: {
            productId_paymentMethod_billingCycle: {
              productId,
              paymentMethod: rule.paymentMethod,
              billingCycle: rule.billingCycle,
            },
          },
          create: {
            productId,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
            price: new Prisma.Decimal(rule.price),
            canInstallment: rule.canInstallment,
            maxInstallments: rule.maxInstallments,
            installmentSplitMode: rule.installmentSplitMode ?? "EQUAL",
            installmentSchedule: rule.installmentSchedule ?? [],
          },
          update: {
            price: new Prisma.Decimal(rule.price),
            canInstallment: rule.canInstallment,
            maxInstallments: rule.maxInstallments,
            installmentSplitMode: rule.installmentSplitMode ?? "EQUAL",
            installmentSchedule: rule.installmentSchedule ?? [],
          },
        })
      )
    )
  }

  async findLockedBillingCycles(
    productId: string
  ): Promise<Array<"monthly" | "quarterly" | "semiannual" | "annual">> {
    // Lock via tabela Backoffice* (não consulta ProfileSubscription do domínio produto).
    const userSubs = await prisma.backofficeUserSubscription.findMany({
      where: { productId, status: "active" },
      select: { cycle: true },
    })

    const locked = new Set<"monthly" | "quarterly" | "semiannual" | "annual">()
    const normalize = (value: string | null | undefined) => {
      if (!value) return null
      const lower = value.toLowerCase()
      if (
        lower === "monthly" ||
        lower === "quarterly" ||
        lower === "semiannual" ||
        lower === "annual"
      ) {
        return lower as "monthly" | "quarterly" | "semiannual" | "annual"
      }
      return null
    }

    for (const sub of userSubs) {
      const cycle = normalize(sub.cycle)
      if (cycle) locked.add(cycle)
    }

    // Assinatura ativa sem ciclo: trava todos os ciclos já existentes no produto
    const hasActiveWithoutCycle = userSubs.some((sub) => !sub.cycle)
    if (hasActiveWithoutCycle) {
      const existing = await prisma.backofficeProductPaymentRule.findMany({
        where: { productId },
        select: { billingCycle: true },
      })
      for (const rule of existing) {
        const cycle = normalize(rule.billingCycle)
        if (cycle) locked.add(cycle)
      }
    }

    return Array.from(locked)
  }

  async syncPaymentRules(
    productId: string,
    rules: UpsertPaymentRuleInput[],
    lockedCycles: Array<"monthly" | "quarterly" | "semiannual" | "annual">
  ): Promise<{ blockedRemovals: string[]; blockedUpdates: string[] }> {
    const existing = await prisma.backofficeProductPaymentRule.findMany({ where: { productId } })
    const locked = new Set(lockedCycles)
    const incomingKeys = new Set(rules.map((r) => `${r.paymentMethod}:${r.billingCycle}`))
    const blockedRemovals: string[] = []
    const blockedUpdates: string[] = []

    const toDelete = existing.filter((rule) => {
      const key = `${rule.paymentMethod}:${rule.billingCycle}`
      if (incomingKeys.has(key)) return false
      if (locked.has(rule.billingCycle as "monthly" | "quarterly" | "semiannual" | "annual")) {
        blockedRemovals.push(rule.billingCycle)
        return false
      }
      return true
    })

    const safeRules: UpsertPaymentRuleInput[] = []
    for (const rule of rules) {
      const current = existing.find(
        (item) =>
          item.paymentMethod === rule.paymentMethod && item.billingCycle === rule.billingCycle
      )
      if (
        current &&
        locked.has(rule.billingCycle) &&
        (Number(current.price.toString()) !== rule.price ||
          (current.installmentSplitMode ?? "EQUAL") !== (rule.installmentSplitMode ?? "EQUAL") ||
          (current.canInstallment ?? false) !== (rule.canInstallment ?? false) ||
          current.maxInstallments !== rule.maxInstallments ||
          JSON.stringify(current.installmentSchedule ?? []) !==
            JSON.stringify(rule.installmentSchedule ?? []))
      ) {
        blockedUpdates.push(rule.billingCycle)
        continue
      }
      safeRules.push(rule)
    }

    await prisma.$transaction(async (tx) => {
      if (toDelete.length) {
        await tx.backofficeProductPaymentRule.deleteMany({
          where: { id: { in: toDelete.map((r) => r.id) } },
        })
      }
      for (const rule of safeRules) {
        await tx.backofficeProductPaymentRule.upsert({
          where: {
            productId_paymentMethod_billingCycle: {
              productId,
              paymentMethod: rule.paymentMethod,
              billingCycle: rule.billingCycle,
            },
          },
          create: {
            productId,
            paymentMethod: rule.paymentMethod,
            billingCycle: rule.billingCycle,
            price: new Prisma.Decimal(rule.price),
            canInstallment: rule.canInstallment,
            maxInstallments: rule.maxInstallments,
            installmentSplitMode: rule.installmentSplitMode ?? "EQUAL",
            installmentSchedule: rule.installmentSchedule ?? [],
          },
          update: {
            price: new Prisma.Decimal(rule.price),
            canInstallment: rule.canInstallment,
            maxInstallments: rule.maxInstallments,
            installmentSplitMode: rule.installmentSplitMode ?? "EQUAL",
            installmentSchedule: rule.installmentSchedule ?? [],
          },
        })
      }
    })

    return { blockedRemovals: Array.from(new Set(blockedRemovals)), blockedUpdates: Array.from(new Set(blockedUpdates)) }
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeProduct.delete({ where: { id } })
  }

  async hasActiveSubscriptions(id: string): Promise<boolean> {
    const count = await prisma.backofficeUserSubscription.count({
      where: { productId: id, status: "active" },
    })
    return count > 0
  }
}
