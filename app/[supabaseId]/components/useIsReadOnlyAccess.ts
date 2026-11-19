"use client"

import { useOptionalTeamContext } from "@/app/context/TeamContext"

/** true quando a conta está em somente leitura (dias 6 a 15 do vencimento). */
export function useIsReadOnlyAccess(): boolean {
  return useOptionalTeamContext()?.accountAccessDecision?.state === "read_only"
}
