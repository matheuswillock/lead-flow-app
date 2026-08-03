"use client"

import { History } from "lucide-react"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"
import { useBackofficeHistorico } from "../hooks/useBackofficeHistorico"
import { BackofficeHistoricoFiltersBar } from "../components/BackofficeHistoricoFiltersBar"
import { BackofficeHistoricoTable } from "../components/BackofficeHistoricoTable"
import { BackofficeHistoricoDetailSheet } from "../components/BackofficeHistoricoDetailSheet"

export function BackofficeHistoricoContainer() {
  const { masterId, selectedTeamId, refreshKey } = useBackofficeClientEmailsContext()
  const historico = useBackofficeHistorico(masterId, selectedTeamId, refreshKey)

  if (!selectedTeamId) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <History className="size-6" />
        <h2 className="text-lg font-semibold">Histórico de e-mails</h2>
      </div>

      <BackofficeHistoricoFiltersBar {...historico} />
      <BackofficeHistoricoTable {...historico} />
      <BackofficeHistoricoDetailSheet {...historico} />
    </div>
  )
}
