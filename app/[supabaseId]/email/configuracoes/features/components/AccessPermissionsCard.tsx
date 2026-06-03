"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useEmailSettingsContext } from "../context/EmailSettingsContext"

const ROLES = [
  { value: "manager", label: "Manager" },
  { value: "backoffice", label: "Backoffice" },
  { value: "operator", label: "Operador" },
] as const

export function AccessPermissionsCard() {
  const {
    loading,
    saving,
    dispatchAllowedRoles,
    templateCreateRoles,
    toggleDispatchRole,
    toggleTemplateCreateRole,
  } = useEmailSettingsContext()

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Permissões de acesso</CardTitle>
        <CardDescription>
          Defina quais perfis podem disparar campanhas e criar templates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Quem pode disparar campanhas</Label>
              <div className="flex flex-col gap-2">
                {ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id={`dispatch-${role.value}`}
                      checked={dispatchAllowedRoles.includes(role.value)}
                      onCheckedChange={() => toggleDispatchRole(role.value)}
                      disabled={saving}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <Label className="text-sm font-medium">Quem pode criar templates</Label>
              <div className="flex flex-col gap-2">
                {ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      id={`create-${role.value}`}
                      checked={templateCreateRoles.includes(role.value)}
                      onCheckedChange={() => toggleTemplateCreateRole(role.value)}
                      disabled={saving}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
