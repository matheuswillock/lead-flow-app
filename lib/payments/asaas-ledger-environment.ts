import { detectAsaasEnvironment } from "@/lib/asaas/asaas-account"

/** Ambiente do ledger para o Asaas: uma única regra, a mesma que escolhe a URL do cliente Asaas. */
export function resolveAsaasLedgerEnvironment(): "DEV" | "PRODUCTION" {
  return detectAsaasEnvironment() === "production" ? "PRODUCTION" : "DEV"
}
