import { useContext } from "react"
import { CronExecutionsContext } from "./CronExecutionsContext"

export function useCronExecutions() {
  const context = useContext(CronExecutionsContext)
  if (!context) {
    throw new Error("useCronExecutions deve ser usado dentro de CronExecutionsProvider")
  }
  return context
}
