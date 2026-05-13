import type { IFeatureAccessService, ResolveFeatureAccessInput, FeatureAccessResult } from "./IFeatureAccessService"
import { FEATURE_PRODUCT_SLUG_MAP } from "@/lib/features/feature-product-slug-map"
import type { IFeatureAccessRepository, UserRoleInfo } from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"
import { FeatureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "past_due"])

function roleHasPublicAccess(level: string): boolean {
  switch (level) {
    case "NONE":
      return false
    case "READ":
    case "FULL":
    default:
      return true
  }
}

function principalsForUser(user: UserRoleInfo): Set<string> {
  const principals = new Set<string>()
  if (user.isMaster) principals.add("MASTER")
  if (user.role === "manager") principals.add("MANAGER")
  if (user.role === "backoffice") principals.add("BACKOFFICE")
  if (user.role === "operator") principals.add("OPERATOR")
  if (user.functions.includes("SDR")) principals.add("SDR")
  if (user.functions.includes("CLOSER")) principals.add("CLOSER")
  if (user.canManageAccountTeams) principals.add("CAN_MANAGE_TEAMS")
  if (user.canCreateAccountUsers) principals.add("CAN_CREATE_USERS")
  return principals
}

export class FeatureAccessService implements IFeatureAccessService {
  constructor(private readonly repository: IFeatureAccessRepository) {}

  async resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<FeatureAccessResult> {
    const ownerProfileId = data.managerId || data.profileId

    const [features, ownerProfile, ownerProfileSubscription, userSubscriptions, ownerSubscriptions, betaGrants, currentUserRole] =
      await Promise.all([
        this.repository.listActiveFeatures(),
        this.repository.findOwnerProfile(ownerProfileId),
        this.repository.findOwnerProfileSubscription(ownerProfileId),
        this.repository.listActiveUserSubscriptions(data.profileId),
        this.repository.listActiveUserSubscriptions(ownerProfileId),
        this.repository.listActiveBetaGrantsForProfile(data.profileId),
        this.repository.findCurrentUserRoleInfo(data.profileId),
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
    const featureById = new Map(features.map((f) => [f.id, f]))
    const allowedSlugs = new Set<string>()
    const betaParentIds = new Set(features.filter((f) => f.betaEnabled).map((f) => f.id))
    const betaSlugs = features
      .filter((f) => f.betaEnabled || (f.parentId !== null && betaParentIds.has(f.parentId)))
      .map((f) => f.slug)

    const safeUserRole: UserRoleInfo = currentUserRole ?? {
      isMaster: false,
      role: "operator",
      functions: [],
      canManageAccountTeams: false,
      canCreateAccountUsers: false,
    }
    const resolvedUserPrincipals = principalsForUser(safeUserRole)

    for (const feature of features) {
      let hasAccess = false

      if (feature.accessMode === "PUBLIC") {
        if (feature.accessRules.length > 0) {
          const matchingRules = feature.accessRules.filter((rule) => resolvedUserPrincipals.has(rule.principal))
          hasAccess = matchingRules.some((rule) => rule.accessLevel !== "NONE")
        } else {
          hasAccess = roleHasPublicAccess(feature.defaultAccessLevel)
        }
      } else if (feature.accessMode === "PAID" || feature.accessMode === "ADDON") {
        const effectiveProductSlug = feature.productSlug ?? FEATURE_PRODUCT_SLUG_MAP[feature.slug]
        const hasSubscription =
          hasPermanentAccess ||
          (effectiveProductSlug ? paidProductSlugs.has(effectiveProductSlug) : false)

        if (hasSubscription && feature.accessRules.length > 0) {
          const matchingRules = feature.accessRules.filter((rule) => resolvedUserPrincipals.has(rule.principal))
          hasAccess = matchingRules.some((rule) => rule.accessLevel !== "NONE")
        } else {
          hasAccess = hasSubscription
        }
      }

      if (!hasAccess && feature.betaEnabled && betaFeatureIds.has(feature.id)) {
        hasAccess = true
      }

      if (hasAccess) {
        allowedSlugs.add(feature.slug)
      }
    }

    // Propagate parent access to children automatically.
    for (const feature of features) {
      if (feature.parentId && allowedSlugs.has(featureById.get(feature.parentId)?.slug ?? "")) {
        allowedSlugs.add(feature.slug)
      }
    }

    return { slugs: Array.from(allowedSlugs), betaSlugs }
  }
}

export const featureAccessService = new FeatureAccessService(new FeatureAccessRepository())
