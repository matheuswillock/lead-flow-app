import { isManagerLikeRole } from "@/lib/roles"

/** Quem pode usar o simulador: gestor, ou SDR/Closer. Mesma regra da rota antiga. */
export function hasPlanSimulatorAccess(role: string, functions: string[]): boolean {
  if (isManagerLikeRole(role)) return true
  return functions.includes("SDR") || functions.includes("CLOSER")
}
