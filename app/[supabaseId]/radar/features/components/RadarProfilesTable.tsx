"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
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

type RadarProfilesTableProps = {
  profiles: RadarProfileListItem[]
  isLoading: boolean
  error: string | null
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onViewProfile: (id: string) => void
}

export function RadarProfilesTable({
  profiles,
  isLoading,
  error,
  page,
  total,
  pageSize,
  onPageChange,
  onViewProfile,
}: RadarProfilesTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
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
                  <Button size="sm" variant="ghost" onClick={() => onViewProfile(profile.id)}>
                    Detalhe
                  </Button>
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
                <EligibilityBadge profile={profile} />
              </div>
              {profile.primarySegmentName ? (
                <Badge variant="secondary" className="w-fit text-xs">
                  {profile.primarySegmentName}
                </Badge>
              ) : null}
              <p className="text-xs text-muted-foreground">{profile.displayPhone ?? "—"}</p>
              <Button size="sm" variant="outline" onClick={() => onViewProfile(profile.id)}>
                Ver detalhe
              </Button>
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
    </>
  )
}
