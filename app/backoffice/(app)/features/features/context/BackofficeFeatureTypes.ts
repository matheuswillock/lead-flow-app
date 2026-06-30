import type { BackofficeFeatureAccessLevel, BackofficeFeatureAccessMode } from "@prisma/client"

export interface AccessRuleFormEntry {
  principal: string
  accessLevel: string
}

export interface BackofficeFeatureItem {
  id: string
  slug: string
  name: string
  description: string | null
  accessMode: BackofficeFeatureAccessMode
  defaultAccessLevel: BackofficeFeatureAccessLevel
  betaEnabled: boolean
  inheritParentSettings: boolean
  billedSeparately: boolean
  isActive: boolean
  sortOrder: number
  productSlug: string | null
  parentId: string | null
  parent: { id: string; slug: string; name: string } | null
  children: { id: string; slug: string; name: string }[]
  grants: {
    id: string
    profileId: string
    isActive: boolean
    profile: { id: string; fullName: string | null; email: string | null }
  }[]
  accessRules: AccessRuleFormEntry[]
  createdAt: string
  updatedAt: string
}

export interface BackofficeFeatureFormData {
  name: string
  description: string
  accessMode: BackofficeFeatureAccessMode
  defaultAccessLevel: BackofficeFeatureAccessLevel
  betaEnabled: boolean
  inheritParentSettings: boolean
  billedSeparately: boolean
  isActive: boolean
  sortOrder: string
  productSlug: string
  parentId: string
  accessRules: AccessRuleFormEntry[]
}

export const EMPTY_FEATURE_FORM: BackofficeFeatureFormData = {
  name: "",
  description: "",
  accessMode: "PUBLIC",
  defaultAccessLevel: "FULL",
  betaEnabled: false,
  inheritParentSettings: false,
  billedSeparately: false,
  isActive: true,
  sortOrder: "0",
  productSlug: "",
  parentId: "",
  accessRules: [],
}
