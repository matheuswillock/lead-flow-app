import { useBackofficeFeature } from "./BackofficeFeatureContext"

export function useBackofficeFeatureHook() {
  return useBackofficeFeature()
}
