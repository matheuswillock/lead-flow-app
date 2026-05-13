import type { IFeatureAccessService, ResolveFeatureAccessInput } from "./IFeatureAccessService"
import { FEATURE_PRODUCT_SLUG_MAP } from "@/lib/features/feature-product-slug-map"
import type { IFeatureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"
import { FeatureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "past_due"])

export class FeatureAccessService implements IFeatureAccessService {
  constructor(private readonly repository: IFeatureAccessRepository) {}

  async resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<string[]> {
    const ownerProfileId = data.managerId || data.profileId

    const [features, ownerProfile, ownerProfileSubscription, userSubscriptions, ownerSubscriptions, betaGrants] =
      await Promise.all([
        this.repository.listActiveFeatures(),
        this.repository.findOwnerProfile(ownerProfileId),
        this.repository.findOwnerProfileSubscription(ownerProfileId),
        this.repository.listActiveUserSubscriptions(data.profileId),
        this.repository.listActiveUserSubscriptions(ownerProfileId),
        this.repository.listActiveBetaGrantsForProfile(data.profileId),
      ])

    const hasPermanentAccess =
      ownerProfile?.hasPermanentSubscription === true ||
      ownerProfileSubscription?.hasPermanentSubscription === true

    const hasActiveMainSubscription =
      ACTIVE_SUBSCRIPTION_STATUSES.has(ownerProfile?.subscriptionStatus ?? "") ||
      ACTIVE_SUBSCRIPTION_STATUSES.has(ownerProfileSubscription?.subscriptionStatus ?? "")

    const paidProductSlugs = new Set<string>()
    for (const item of userSubscriptions) {
      paidProductSlugs.add(item.product.slug)
    }
    for (const item of ownerSubscriptions) {
      paidProductSlugs.add(item.product.slug)
    }

    if (hasActiveMainSubscription && ownerProfileSubscription?.product?.slug) {
      paidProductSlugs.add(ownerProfileSubscription.product.slug)
    }

    const betaFeatureIds = new Set(betaGrants.map((item) => item.featureId))
    const allowedSlugs = new Set<string>()

    for (const feature of features) {
      let hasAccess = false

      if (feature.accessMode === "PUBLIC") {
        hasAccess = feature.defaultAccessLevel !== "NONE"
      } else if (feature.accessMode === "PAID") {
        const effectiveProductSlug = feature.productSlug ?? FEATURE_PRODUCT_SLUG_MAP[feature.slug]
        hasAccess =
          hasPermanentAccess ||
          (effectiveProductSlug ? paidProductSlugs.has(effectiveProductSlug) : false)
      }

      if (!hasAccess && feature.betaEnabled && betaFeatureIds.has(feature.id)) {
        hasAccess = true
      }

      if (hasAccess) {
        allowedSlugs.add(feature.slug)
      }
    }

    return Array.from(allowedSlugs)
  }
}

export const featureAccessService = new FeatureAccessService(new FeatureAccessRepository())
