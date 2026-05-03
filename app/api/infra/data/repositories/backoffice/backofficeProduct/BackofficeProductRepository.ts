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
      orderBy: [{ type: "asc" }, { name: "asc" }],
    })
  }

  async findAllWithPaymentRules(): Promise<BackofficeProductWithPaymentRules[]> {
    return prisma.backofficeProduct.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
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

  async findBySlug(slug: string): Promise<BackofficeProduct | null> {
    return prisma.backofficeProduct.findUnique({ where: { slug } })
  }

  async findBySlugWithPaymentRules(slug: string): Promise<BackofficeProductWithPaymentRules | null> {
    return prisma.backofficeProduct.findUnique({
      where: { slug },
      include: paymentRulesInclude,
    })
  }

  async create(data: CreateBackofficeProductInput): Promise<BackofficeProduct> {
    return prisma.backofficeProduct.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        type: data.type,
        billingMode: data.billingMode,
        priceMonthly: toDecimalOrNull(data.priceMonthly),
        priceQuarterly: toDecimalOrNull(data.priceQuarterly),
        priceSemiannual: toDecimalOrNull(data.priceSemiannual),
        priceLifetime: toDecimalOrNull(data.priceLifetime),
        isActive: data.isActive ?? true,
      },
    })
  }

  async update(id: string, data: UpdateBackofficeProductInput): Promise<BackofficeProduct> {
    return prisma.backofficeProduct.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
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
        ...(Object.prototype.hasOwnProperty.call(data, "priceLifetime") && {
          priceLifetime: toDecimalOrNull(data.priceLifetime),
        }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async upsertPaymentRules(productId: string, rules: UpsertPaymentRuleInput[]): Promise<void> {
    await Promise.all(
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
          },
          update: {
            price: new Prisma.Decimal(rule.price),
            canInstallment: rule.canInstallment,
            maxInstallments: rule.maxInstallments,
          },
        })
      )
    )
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
