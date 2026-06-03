"use client"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"
import { SenderCard } from "../components/SenderCard"
import { DispatchRestrictionsCard } from "../components/DispatchRestrictionsCard"
import { AccessPermissionsCard } from "../components/AccessPermissionsCard"
import { TemplateApprovalCard } from "../components/TemplateApprovalCard"
import { CustomDomainCard } from "../components/CustomDomainCard"

export function EmailSettingsContainer() {
  const { saving, loading, fromName, fromEmail, handleSave } = useEmailSettingsContext()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Configurações de Email</h1>
      </div>

      <SenderCard />
      <DispatchRestrictionsCard />
      <AccessPermissionsCard />
      <TemplateApprovalCard />
      <CustomDomainCard />

      <div className="max-w-2xl">
        <Button
          onClick={() => void handleSave()}
          disabled={saving || loading || !fromName.trim() || !fromEmail.trim()}
        >
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  )
}
