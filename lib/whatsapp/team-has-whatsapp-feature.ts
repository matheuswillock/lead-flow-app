import { prisma } from "@/app/api/infra/data/prisma"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"

export async function teamHasWhatsAppFeature(teamId: string): Promise<boolean> {
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
              feature: { slug: FEATURE_SLUGS.WHATSAPP, isActive: true },
            },
            select: { id: true },
            take: 1,
          },
          backofficeSubscriptions: {
            where: {
              status: "active",
              OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
            },
            select: { product: { select: { featureSlug: true } } },
          },
          subscription: {
            select: {
              hasPermanentSubscription: true,
              product: { select: { featureSlug: true } },
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

  const paidProductSlugs = new Set<string>()
  for (const subscription of owner.backofficeSubscriptions) {
    paidProductSlugs.add(subscription.product.featureSlug)
  }
  if (owner.subscription?.product?.featureSlug) {
    paidProductSlugs.add(owner.subscription.product.featureSlug)
  }

  return paidProductSlugs.has("whatsapp")
}
