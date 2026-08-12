"use client"

import { Settings2, UserPlus, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import type { BetaFeatureItem, BetaGrantItem } from "../context/BackofficeBetaTypes"
import { useBackofficeBeta } from "../context/BackofficeBetaContext"
import { betaBillingLabel, scopeLabel } from "../utils/betaScopeLabel"

function initials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

interface Props {
  feature: BetaFeatureItem
}

export function BackofficeBetaFeatureCard({ feature }: Props) {
  const { openAddDialog, openEditScopeDialog, removeBetaUser, isRemoving } = useBackofficeBeta()

  const activeGrants = feature.grants.filter((g) => g.isActive)

  return (
    <div className="rounded-lg border bg-card flex flex-col">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{feature.name}</span>
            <Badge variant="outline" className="text-orange-500 border-orange-500/40 text-[10px]">
              Beta
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {betaBillingLabel(feature.chargeDuringBeta)}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {activeGrants.length}
            </Badge>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{feature.slug}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openAddDialog(feature)}
          className="shrink-0"
        >
          <UserPlus data-icon="inline-start" />
          Adicionar
        </Button>
      </div>

      <Separator />

      <div className="flex flex-col gap-1 p-4">
        {activeGrants.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            Nenhum master no grupo beta desta funcionalidade.
          </p>
        )}

        {activeGrants.map((grant: BetaGrantItem) => {
          const key = `${feature.id}:${grant.profileId}`
          const removing = isRemoving[key] ?? false

          return (
            <div
              key={grant.profileId}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {initials(grant.profile.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">
                    {grant.profile.fullName ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {grant.profile.email ?? "—"}
                  </p>
                  <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                    {scopeLabel(grant)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  disabled={removing}
                  onClick={() => openEditScopeDialog(feature, grant)}
                  aria-label={`Editar escopo de ${grant.profile.fullName ?? grant.profileId}`}
                >
                  <Settings2 className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={removing}
                  onClick={() => removeBetaUser(feature.id, grant.profileId)}
                  aria-label={`Remover ${grant.profile.fullName ?? grant.profileId} do grupo beta`}
                >
                  {removing ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
