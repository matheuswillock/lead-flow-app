"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState } from "react"
import { UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RadarProfileListItem } from "../context/RadarTypes"
import { EligibilityBadge, SourceBadges } from "./RadarProfileBadges"
import { RadarEngagementBadge } from "./RadarEngagementBadge"
import { PromoteRadarProfileAlertDialog } from "./PromoteRadarProfileAlertDialog"

// DA18: promoção item a item — lote fica para uma iteração futura se houver demanda.

type RadarSegmentProfilesListProps = {
  profiles: RadarProfileListItem[]
  isLoading: boolean
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onViewProfile: (id: string) => void
  showPromoteAction?: boolean
  onPromoteProfile?: (profileId: string) => Promise<boolean>
}

export function RadarSegmentProfilesList({
  profiles,
  isLoading,
  page,
  total,
  pageSize,
  onPageChange,
  onViewProfile,
  showPromoteAction = false,
  onPromoteProfile,
}: RadarSegmentProfilesListProps) {
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<RadarProfileListItem | null>(null)
  const [isPromoting, setIsPromoting] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPromote = showPromoteAction && Boolean(onPromoteProfile)

  const openPromoteDialog = (profile: RadarProfileListItem) => {
    setSelectedProfile(profile)
    setPromoteDialogOpen(true)
  }

  const handleConfirmPromote = async () => {
    if (!selectedProfile || !onPromoteProfile) return
    setIsPromoting(true)
    try {
      const success = await onPromoteProfile(selectedProfile.id)
      if (success) {
        setPromoteDialogOpen(false)
        setSelectedProfile(null)
      }
    } finally {
      setIsPromoting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (profiles.length === 0) {
    return null
  }

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Temp.</TableHead>
              <TableHead>Consentimento</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Última interação</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{profile.displayName}</span>
                    <span className="text-xs text-muted-foreground">{profile.displayPhone ?? "—"}</span>
                    {profile.primaryEmail ? (
                      <span className="text-xs text-muted-foreground">{profile.primaryEmail}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  {profile.primarySegmentName ? (
                    <Badge variant="secondary" className="text-xs">
                      {profile.primarySegmentName}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <RadarEngagementBadge band={profile.engagementBand} />
                </TableCell>
                <TableCell>
                  <EligibilityBadge profile={profile} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <SourceBadges profile={profile} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {profile.lastSeenAt
                    ? format(new Date(profile.lastSeenAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                    : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {canPromote ? (
                      <Button size="sm" variant="outline" onClick={() => openPromoteDialog(profile)}>
                        <UserPlus data-icon="inline-start" />
                        Promover a Lead
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => onViewProfile(profile.id)}>
                      Detalhe
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{profile.displayName}</span>
                <div className="flex flex-wrap items-center justify-end gap-1">
                  <RadarEngagementBadge band={profile.engagementBand} />
                  <EligibilityBadge profile={profile} />
                </div>
              </div>
              {profile.primarySegmentName ? (
                <Badge variant="secondary" className="w-fit text-xs">
                  {profile.primarySegmentName}
                </Badge>
              ) : null}
              <p className="text-xs text-muted-foreground">{profile.displayPhone ?? "—"}</p>
              <div className="flex flex-col gap-2">
                {canPromote ? (
                  <Button size="sm" variant="outline" onClick={() => openPromoteDialog(profile)}>
                    <UserPlus data-icon="inline-start" />
                    Promover a Lead
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => onViewProfile(profile.id)}>
                  Ver detalhe
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Página {page} de {totalPages} ({total} perfis)
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
      {canPromote && selectedProfile ? (
        <PromoteRadarProfileAlertDialog
          open={promoteDialogOpen}
          onOpenChange={setPromoteDialogOpen}
          displayName={selectedProfile.displayName}
          primaryEmail={selectedProfile.primaryEmail}
          isPromoting={isPromoting}
          onConfirm={handleConfirmPromote}
        />
      ) : null}
    </>
  )
}
