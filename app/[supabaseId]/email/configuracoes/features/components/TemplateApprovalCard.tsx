"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"

export function TemplateApprovalCard() {
  const { loading, saving, templateApprovalRequired, setTemplateApprovalRequired } =
    useEmailSettingsContext()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Aprovação de templates</CardTitle>
        <CardDescription>
          Quando ativo, templates criados por operadores precisam ser aprovados antes de poderem ser usados em campanhas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-48" />
        ) : (
          <div className="flex items-center gap-3">
            <Switch
              id="approval-required"
              checked={templateApprovalRequired}
              onCheckedChange={setTemplateApprovalRequired}
              disabled={saving}
            />
            <Label htmlFor="approval-required" className="cursor-pointer">
              Exigir aprovação de templates criados por operadores
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
