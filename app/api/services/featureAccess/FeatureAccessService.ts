import type { IFeatureAccessService, ResolveFeatureAccessInput, FeatureAccessResult } from "./IFeatureAccessService"
import { FEATURE_PRODUCT_SLUG_MAP } from "@/lib/features/feature-product-slug-map"
import type {
  IFeatureAccessRepository,
  UserRoleInfo,
} from "@/app/api/infra/data/repositories/featureAccess/IFeatureAccessRepository"
import type { BackofficeFeature, BackofficeFeatureAccessRule } from "@prisma/client"
import { FeatureAccessRepository } from "@/app/api/infra/data/repositories/featureAccess/FeatureAccessRepository"
import { isAccountSubscriptionActive } from "@/lib/subscription/isAccountSubscriptionActive"

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "past_due"])

type ActiveFeature = BackofficeFeature & { accessRules: BackofficeFeatureAccessRule[] }

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

function evaluatePrincipalRules(
  accessRules: BackofficeFeatureAccessRule[],
  defaultAccessLevel: string,
  principals: Set<string>
): boolean {
  if (accessRules.length > 0) {
    const matchingRules = accessRules.filter((rule) => principals.has(rule.principal))
    return matchingRules.some((rule) => rule.accessLevel !== "NONE")
  }

  return roleHasPublicAccess(defaultAccessLevel)
}

function resolveBillingProductSlug(
  feature: ActiveFeature,
  featureById: Map<string, ActiveFeature>
): string | null {
  if (!feature.parentId || !feature.billedSeparately) {
    const visited = new Set<string>()
    let current: ActiveFeature | undefined = feature

    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id)
      const parent = featureById.get(current.parentId)
      if (!parent) break
      if (!parent.billedSeparately) {
        current = parent
        continue
      }
      break
    }

    const slug = current?.productSlug ?? FEATURE_PRODUCT_SLUG_MAP[current?.slug ?? ""]
    return slug ?? null
  }

  return feature.productSlug ?? FEATURE_PRODUCT_SLUG_MAP[feature.slug] ?? null
}

export class FeatureAccessService implements IFeatureAccessService {
  constructor(private readonly repository: IFeatureAccessRepository) {}

  async resolveAllowedSlugs(data: ResolveFeatureAccessInput): Promise<FeatureAccessResult> {
    const ownerProfileId = data.managerId || data.profileId

    const [
      features,
      ownerProfile,
      ownerProfileSubscription,
      userSubscriptions,
      ownerSubscriptions,
      currentUserRole,
      ownerUserType,
    ] = await Promise.all([
      this.repository.listActiveFeatures(),
      this.repository.findOwnerProfile(ownerProfileId),
      this.repository.findOwnerProfileSubscription(ownerProfileId),
      this.repository.listActiveUserSubscriptions(data.profileId),
      this.repository.listActiveUserSubscriptions(ownerProfileId),
      this.repository.findCurrentUserRoleInfo(data.profileId),
      this.repository.findUserTypeAssignment(ownerProfileId),
    ])

    const userTypeSlug = ownerUserType?.slug ?? "common"
    const memberProExpiresAt = ownerUserType?.accessExpiresAt ?? null
    const memberProActive =
      userTypeSlug === "member_pro" &&
      (memberProExpiresAt === null || new Date(memberProExpiresAt).getTime() > Date.now())

    const safeUserRole: UserRoleInfo = {
      ...(currentUserRole ?? {
        isMaster: false,
        role: "operator",
        functions: [],
        canManageAccountTeams: false,
        canCreateAccountUsers: false,
        userTypeSlug: "common",
        memberProActive: false,
        memberProExpiresAt: null,
        activeTeamId: null,
      }),
      userTypeSlug,
      memberProActive,
      memberProExpiresAt,
    }

    const accountSubscriptionActive = await isAccountSubscriptionActive(ownerProfileId)
    if (!accountSubscriptionActive) {
      return { slugs: [], betaSlugs: [], betaLabelSlugs: [], userRole: safeUserRole }
    }

    const betaEligibleFeatureIds = await this.repository.resolveBetaEligibleFeatureIds({
      profileId: data.profileId,
      activeTeamId: data.activeTeamId ?? safeUserRole.activeTeamId,
      managerId: data.managerId || null,
      isMaster: safeUserRole.isMaster,
    })

    const hasPermanentAccess =
      ownerProfile?.hasPermanentSubscription === true ||
      ownerProfileSubscription?.hasPermanentSubscription === true

    const hasActiveMainSubscription =
      ACTIVE_SUBSCRIPTION_STATUSES.has(ownerProfile?.subscriptionStatus ?? "") ||
      ACTIVE_SUBSCRIPTION_STATUSES.has(ownerProfileSubscription?.subscriptionStatus ?? "")

    const paidProductSlugs = new Set<string>()
    for (const item of userSubscriptions) {
      paidProductSlugs.add(item.product.featureSlug)
    }
    for (const item of ownerSubscriptions) {
      paidProductSlugs.add(item.product.featureSlug)
    }

    if (hasActiveMainSubscription && ownerProfileSubscription?.product?.featureSlug) {
      paidProductSlugs.add(ownerProfileSubscription.product.featureSlug)
    }

    const featureById = new Map(features.map((f) => [f.id, f]))
    const allowedSlugs = new Set<string>()

    const resolveEffectiveFeature = (
      featureId: string,
      visited = new Set<string>()
    ): ActiveFeature | undefined => {
      const feature = featureById.get(featureId)
      if (!feature) return undefined

      if (!feature.inheritParentSettings || !feature.parentId) {
        return feature
      }

      if (visited.has(feature.id)) {
        return feature
      }
      visited.add(feature.id)

      const parent = featureById.get(feature.parentId)
      if (!parent) {
        return feature
      }

      return resolveEffectiveFeature(parent.id, visited) ?? feature
    }

    const hasBetaParentInHierarchy = (featureId: string): boolean => {
      const visited = new Set<string>()
      let current = featureById.get(featureId)

      while (current?.parentId) {
        const parent = featureById.get(current.parentId)
        if (!parent || visited.has(parent.id)) {
          return false
        }
        if (parent.betaEnabled) {
          return true
        }
        visited.add(parent.id)
        current = parent
      }

      return false
    }

    const getAncestorFeatureIds = (featureId: string): string[] => {
      const ancestorIds: string[] = []
      const visited = new Set<string>()
      let current = featureById.get(featureId)

      while (current?.parentId) {
        const parent = featureById.get(current.parentId)
        if (!parent || visited.has(parent.id)) {
          break
        }
        ancestorIds.push(parent.id)
        visited.add(parent.id)
        current = parent
      }

      return ancestorIds
    }

    const isBetaEligibleForFeature = (featureId: string, effectiveFeatureId: string): boolean => {
      const candidateIds = new Set([
        featureId,
        effectiveFeatureId,
        ...getAncestorFeatureIds(featureId),
      ])

      for (const candidateId of candidateIds) {
        if (betaEligibleFeatureIds.has(candidateId)) {
          return true
        }
      }

      return false
    }

    const betaSlugs = features
      .filter((feature) => {
        const effectiveFeature = resolveEffectiveFeature(feature.id)
        const isBetaFeature =
          effectiveFeature?.betaEnabled === true || hasBetaParentInHierarchy(feature.id)
        if (!isBetaFeature) return false

        return isBetaEligibleForFeature(feature.id, effectiveFeature?.id ?? feature.id)
      })
      .map((feature) => feature.slug)

    const resolvedUserPrincipals = principalsForUser(safeUserRole)

    for (const feature of features) {
      const effectiveFeature = resolveEffectiveFeature(feature.id) ?? feature
      let hasAccess = false

      if (effectiveFeature.accessMode === "PUBLIC") {
        hasAccess = evaluatePrincipalRules(
          effectiveFeature.accessRules,
          effectiveFeature.defaultAccessLevel,
          resolvedUserPrincipals
        )
      } else if (effectiveFeature.accessMode === "PAID" || effectiveFeature.accessMode === "ADDON") {
        const billingProductSlug = resolveBillingProductSlug(feature, featureById)
        const hasSubscription =
          hasPermanentAccess ||
          (billingProductSlug ? paidProductSlugs.has(billingProductSlug) : false)

        if (hasSubscription && effectiveFeature.accessRules.length > 0) {
          hasAccess = evaluatePrincipalRules(
            effectiveFeature.accessRules,
            effectiveFeature.defaultAccessLevel,
            resolvedUserPrincipals
          )
        } else {
          hasAccess = hasSubscription
        }
      }

      if (
        !hasAccess &&
        effectiveFeature.betaEnabled &&
        isBetaEligibleForFeature(feature.id, effectiveFeature.id)
      ) {
        if (effectiveFeature.accessMode === "PUBLIC") {
          hasAccess = evaluatePrincipalRules(
            effectiveFeature.accessRules,
            effectiveFeature.defaultAccessLevel,
            resolvedUserPrincipals
          )
        } else if (effectiveFeature.accessMode === "PAID" || effectiveFeature.accessMode === "ADDON") {
          hasAccess = evaluatePrincipalRules(
            effectiveFeature.accessRules,
            effectiveFeature.defaultAccessLevel,
            resolvedUserPrincipals
          )
        }
      }

      if (hasAccess) {
        allowedSlugs.add(feature.slug)
      }
    }

    const betaLabelSlugs = features
      .filter((feature) => {
        const effectiveFeature = resolveEffectiveFeature(feature.id)
        const isBetaFeature =
          effectiveFeature?.betaEnabled === true || hasBetaParentInHierarchy(feature.id)
        return isBetaFeature && allowedSlugs.has(feature.slug)
      })
      .map((feature) => feature.slug)

    return { slugs: Array.from(allowedSlugs), betaSlugs, betaLabelSlugs, userRole: safeUserRole }
  }
}

export const featureAccessService = new FeatureAccessService(new FeatureAccessRepository())
