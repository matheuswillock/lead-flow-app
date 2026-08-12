import type { BackofficeFeatureAccessMode } from "@prisma/client"
import type { BackofficeFeatureFormData } from "../context/BackofficeFeatureTypes"

export const CHARGE_DURING_BETA_HINT =
  "Desligado: beta gratuito. Ligado: Grupo Beta pode acessar/comprar, mas o uso exige pagamento do produto."

export const CHARGE_DURING_BETA_PRODUCT_REQUIRED_HINT =
  "Para ligar esta opção, selecione um produto válido em Precificação."

export function isChargeDuringBetaVisible(betaEnabled: boolean): boolean {
  return betaEnabled === true
}

export function canChargeDuringBeta(input: {
  betaEnabled: boolean
  accessMode: BackofficeFeatureAccessMode | string
  productSlug: string
}): boolean {
  if (!input.betaEnabled) return false
  if (input.accessMode !== "PAID" && input.accessMode !== "ADDON") return false
  return Boolean(input.productSlug.trim())
}

export function getChargeDuringBetaClientHint(input: {
  chargeDuringBeta: boolean
  betaEnabled: boolean
  accessMode: BackofficeFeatureAccessMode | string
  productSlug: string
}): string | null {
  if (!input.chargeDuringBeta) return null
  if (!canChargeDuringBeta(input)) {
    return CHARGE_DURING_BETA_PRODUCT_REQUIRED_HINT
  }
  return null
}

export function isChargeDuringBetaSaveBlocked(formData: Pick<
  BackofficeFeatureFormData,
  "chargeDuringBeta" | "betaEnabled" | "accessMode" | "productSlug"
>): boolean {
  return getChargeDuringBetaClientHint(formData) !== null
}

export function formToPayload(data: BackofficeFeatureFormData | Partial<BackofficeFeatureFormData>) {
  const payload: Record<string, unknown> = {}

  if (data.name !== undefined) payload.name = data.name
  if ("description" in data) payload.description = data.description || null
  if (data.accessMode !== undefined) payload.accessMode = data.accessMode
  if (data.defaultAccessLevel !== undefined) payload.defaultAccessLevel = data.defaultAccessLevel
  if (data.betaEnabled !== undefined) payload.betaEnabled = data.betaEnabled
  if (data.chargeDuringBeta !== undefined) payload.chargeDuringBeta = data.chargeDuringBeta
  if (data.inheritParentSettings !== undefined) {
    payload.inheritParentSettings = data.inheritParentSettings
  }
  if (data.billedSeparately !== undefined) payload.billedSeparately = data.billedSeparately
  if (data.isActive !== undefined) payload.isActive = data.isActive
  if ("sortOrder" in data) payload.sortOrder = parseInt(data.sortOrder ?? "0", 10) || 0
  if ("productSlug" in data) payload.productSlug = data.productSlug || null
  if ("parentId" in data) payload.parentId = data.parentId || null
  if ("accessRules" in data) payload.accessRules = data.accessRules ?? []

  return payload
}

export function applyBetaEnabledChange(
  prev: BackofficeFeatureFormData,
  betaEnabled: boolean
): BackofficeFeatureFormData {
  if (!betaEnabled) {
    return { ...prev, betaEnabled: false, chargeDuringBeta: false }
  }
  return { ...prev, betaEnabled: true, chargeDuringBeta: false }
}
