export function isBetaGroupEligible(feature: {
  betaEnabled: boolean
  inheritParentSettings: boolean
}): boolean {
  return feature.betaEnabled && !feature.inheritParentSettings
}
