import { useContext } from "react"
import { CampanhasAnalyticsContext } from "./CampanhasAnalyticsContext"

export function useCampanhasAnalytics() {
  const context = useContext(CampanhasAnalyticsContext)
  if (!context) {
    throw new Error("useCampanhasAnalytics deve ser usado dentro de CampanhasAnalyticsProvider")
  }
  return context
}
