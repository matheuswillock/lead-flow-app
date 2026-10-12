import { prisma } from "@/app/api/infra/data/prisma"
import type { IBackofficeProductRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeProduct/IBackofficeProductRepository"
import { resolveHasUnlimitedUsers } from "@/app/api/shared/billing/memberProBillingRules"
import type {
  BillingCycle,
  BillingQuoteCatalogItem,
  BillingQuoteProjection,
} from "@/app/api/shared/billing/billingQuoteTypes"
import type { IBillingQuoteRepository } from "./IBillingQuoteRepository"

type ProductPriceRow = {
  id: string
  name: string
  isActive: boolean
  priceMonthly: { toString(): string } | null
  priceQuarterly: { toString(): string } | null
  priceQuadrimester: { toString(): string } | null
  priceSemiannual: { toString(): string } | null
  priceAnnual: { toString(): string } | null
}

const productPriceSelect = {
  id: true,
  name: true,
  isActive: true,
  priceMonthly: true,
  priceQuarterly: true,
  priceQuadrimester: true,
  priceSemiannual: true,
  priceAnnual: true,
} as const

function toBillingCycle(value: string | null | undefined): BillingCycle | null {
  switch (value?.toLowerCase()) {
    case "monthly":
      return "monthly"
    case "quarterly":
      return "quarterly"
    case "quadrimester":
      return "quadrimester"
    case "semiannual":
    case "semiannually":
      return "semiannual"
    case "annual":
    case "yearly":
      return "annual"
    default:
      return null
  }
}

function getProductPrice(product: ProductPriceRow, billingCycle: BillingCycle) {
  switch (billingCycle) {
    case "monthly":
      return product.priceMonthly
    case "quarterly":
      return product.priceQuarterly
    case "quadrimester":
      return product.priceQuadrimester
    case "semiannual":
      return product.priceSemiannual
    case "annual":
      return product.priceAnnual
  }
}

function toCatalogItem(
  product: ProductPriceRow | null,
  slug: string,
  billingCycle: BillingCycle | null
): BillingQuoteCatalogItem | null {
  if (!product?.isActive || !billingCycle) {
    return null
  }
  const price = getProductPrice(product, billingCycle)
  if (price == null) {
    return null
  }
  const unitAmount = Number(price.toString())
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    return null
  }
  return { productId: product.id, slug, name: product.name, unitAmount }
}

function withContractedBaseAmount(
  catalogItem: BillingQuoteCatalogItem | null,
  monthlyBaseAmount: { toString(): string } | null | undefined,
  billingCycle: BillingCycle | null
): BillingQuoteCatalogItem | null {
  if (!catalogItem || !monthlyBaseAmount) return catalogItem
  const unitAmount = Number((Number(monthlyBaseAmount.toString()) * ({ monthly: 1, quarterly: 3, quadrimester: 4, semiannual: 6, annual: 12 }[billingCycle ?? "monthly"])).toFixed(2))
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) return catalogItem

  return { ...catalogItem, unitAmount }
}

export class BillingQuoteRepository implements IBillingQuoteRepository {
  constructor(private readonly productRepository: IBackofficeProductRepository) {}

  async getAccessBySupabaseId(supabaseId: string) {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: {
        id: true,
        isMaster: true,
        backofficeBansReceived: {
          where: { status: "ACTIVE" },
          select: { id: true },
          take: 1,
        },
      },
    })

    if (!profile) {
      return null
    }

    return {
      billingOwnerId: profile.id,
      isMaster: profile.isMaster,
      isBanned: profile.backofficeBansReceived.length > 0,
    }
  }

  async getProjection(billingOwnerId: string): Promise<BillingQuoteProjection | null> {
    const [profile, subscription, activeTeams, members] = await Promise.all([
      prisma.profile.findUnique({
        where: { id: billingOwnerId },
        select: {
          id: true,
          hasPermanentSubscription: true,
          hasUnlimitedUsers: true,
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
          subscriptionCycle: true,
        },
      }),
      prisma.profileSubscription.findUnique({
        where: { profileId: billingOwnerId },
        select: {
          hasPermanentSubscription: true,
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
          subscriptionCycle: true,
          product: { select: productPriceSelect },
          adhesion: {
            select: {
              monthlyBaseAmount: true,
            },
          },
          capacity: {
            select: {
              includedExtraTeams: true,
              includedExtraUsers: true,
              manualAdjustmentExtraTeams: true,
              manualAdjustmentExtraUsers: true,
            },
          },
        },
      }),
      prisma.team.count({ where: { masterId: billingOwnerId, deletedAt: null } }),
      prisma.teamMember.findMany({
        where: {
          team: { masterId: billingOwnerId, deletedAt: null },
          profile: { deletedAt: null },
        },
        select: { profileId: true },
        distinct: ["profileId"],
      }),
    ])

    if (!profile) {
      return null
    }

    const billingCycle = toBillingCycle(
      subscription ? subscription.subscriptionCycle : profile.subscriptionCycle
    )
    const [defaultBaseProduct, extraUserProduct, extraTeamProduct] = await Promise.all([
      subscription
        ? Promise.resolve(null)
        : this.productRepository.findDefaultByFeatureSlug("crm"),
      this.productRepository.findDefaultByFeatureSlug("extra-user"),
      this.productRepository.findDefaultByFeatureSlug("extra-team"),
    ])
    const baseProduct = subscription ? subscription.product : defaultBaseProduct
    const distinctMemberIds = new Set(members.map((member) => member.profileId))
    distinctMemberIds.add(billingOwnerId)
    const hasPermanentSubscription = subscription
      ? subscription.hasPermanentSubscription
      : profile.hasPermanentSubscription
    const capacity = subscription?.capacity

    return {
      billingOwnerId,
      billingCycle,
      baseProduct: withContractedBaseAmount(
        toCatalogItem(baseProduct, "crm", billingCycle),
        subscription?.adhesion?.monthlyBaseAmount, billingCycle
      ),
      extraUserProduct: toCatalogItem(extraUserProduct, "extra-user", billingCycle),
      extraTeamProduct: toCatalogItem(extraTeamProduct, "extra-team", billingCycle),
      billableActiveMembers: distinctMemberIds.size,
      activeTeams,
      includedExtraUsers: capacity?.includedExtraUsers ?? 0,
      includedExtraTeams: capacity?.includedExtraTeams ?? 0,
      manualAdjustmentExtraUsers: capacity?.manualAdjustmentExtraUsers ?? 0,
      manualAdjustmentExtraTeams: capacity?.manualAdjustmentExtraTeams ?? 0,
      hasPermanentSubscription,
      hasUnlimitedUsers: resolveHasUnlimitedUsers({
        hasUnlimitedUsersFlag: profile.hasUnlimitedUsers,
        hasPermanentSubscription,
        billingCycle,
      }),
      asaasSubscriptionId: subscription
        ? subscription.asaasSubscriptionId
        : profile.asaasSubscriptionId,
      asaasSubscriptionAccount: subscription
        ? subscription.asaasSubscriptionId
          ? subscription.asaasSubscriptionAccount
          : null
        : profile.asaasSubscriptionId
          ? profile.asaasSubscriptionAccount
          : null,
    }
  }
}
