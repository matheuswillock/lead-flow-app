"use client"

import { Settings2 } from "lucide-react"
import { useBackofficeClientEmailsContext } from "../../context/BackofficeClientEmailsContext"
import { useBackofficeSettings } from "../hooks/useBackofficeSettings"
import {
  BackofficeSettingsCards,
  BackofficeSettingsStickySave,
} from "../components/BackofficeSettingsCards"

export function BackofficeSettingsContainer() {
  const { masterId, selectedTeamId, refreshKey } = useBackofficeClientEmailsContext()
  const settings = useBackofficeSettings(masterId, selectedTeamId, refreshKey)

  if (!selectedTeamId) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Settings2 className="size-6" />
        <h2 className="text-lg font-semibold">Configurações de e-mail</h2>
      </div>
      <BackofficeSettingsCards {...settings} />
      <BackofficeSettingsStickySave
        saving={settings.saving}
        loading={settings.loading}
        onSave={settings.handleSaveSettings}
      />
    </div>
  )
}
