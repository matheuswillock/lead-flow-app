"use client"

import { useState } from "react"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBackofficeLeadQuickEntry } from "../context/BackofficeLeadQuickEntryHook"
import { BackofficeLeadQuickEntryFields } from "../components/BackofficeLeadQuickEntryFields"
import type { BackofficeLeadQuickEntryFormData } from "../context/BackofficeLeadQuickEntryTypes"

const EMPTY_FORM: BackofficeLeadQuickEntryFormData = {
  name: "",
  email: "",
  phone: "",
  notes: "",
  subscribeToLiveCampaign: false,
}

export function BackofficeLeadQuickEntryContainer() {
  const { optInCampaign, isSubmitting, submit } = useBackofficeLeadQuickEntry()
  const [form, setForm] = useState<BackofficeLeadQuickEntryFormData>(EMPTY_FORM)

  async function handleSubmit() {
    if (!form.name.trim()) return
    const ok = await submit(form)
    if (ok) setForm(EMPTY_FORM)
  }

  return (
    <div className="flex min-h-full w-full items-start justify-center p-4 sm:p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="size-5" />
            <CardTitle>Cadastro rápido de lead</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BackofficeLeadQuickEntryFields
            form={form}
            onChange={setForm}
            optInCampaign={optInCampaign}
            disabled={isSubmitting}
          />
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name.trim()}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Cadastrar lead"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
