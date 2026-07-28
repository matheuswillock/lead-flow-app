import { prisma } from "@/app/api/infra/data/prisma"
import { productHasFeatureSlug } from "@/lib/backoffice-products/product-feature-slugs"

export async function teamHasProductFeature(
  teamId: string,
  productFeatureSlug: string,
  betaFeatureSlug: string
): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      master: {
        select: {
          hasPermanentSubscription: true,
          backofficeFeatureGrants: {
            where: {
              grantType: "BETA",
              isActive: true,
              feature: { slug: betaFeatureSlug, isActive: true },
            },
            select: { id: true },
            take: 1,
          },
          backofficeSubscriptions: {
            where: {
              status: "active",
              OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            select: { productId: true },
          },
          subscription: {
            select: {
              hasPermanentSubscription: true,
              productId: true,
            },
          },
        },
      },
    },
  })

  const owner = team?.master
  if (!owner) return false

  if (owner.backofficeFeatureGrants.length > 0) return true

  if (
    owner.hasPermanentSubscription ||
    owner.subscription?.hasPermanentSubscription === true
  ) {
    return true
  }

  const productIds = [
    ...owner.backofficeSubscriptions.map((subscription) => subscription.productId),
    ...(owner.subscription?.productId ? [owner.subscription.productId] : []),
  ]

  if (productIds.length === 0) return false

  const products = await prisma.backofficeProduct.findMany({
    where: { id: { in: productIds } },
    select: { featureSlugs: true },
  })

  return products.some((product) => productHasFeatureSlug(product, productFeatureSlug))
}
