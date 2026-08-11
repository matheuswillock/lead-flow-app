"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { RadarProfileDetail } from "../context/RadarTypes"
import { RadarSegmentProfilesList } from "./RadarSegmentProfilesList"

type RadarSegmentProfilesSheetProps = {
  segmentName: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  profiles: RadarProfileDetail[]
  isLoading: boolean
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onViewProfile: (id: string) => void
  showPromoteAction?: boolean
  onPromoteProfile?: (profileId: string) => Promise<boolean>
}

export function RadarSegmentProfilesSheet({
  segmentName,
  open,
  onOpenChange,
  profiles,
  isLoading,
  page,
  total,
  pageSize,
  onPageChange,
  onViewProfile,
  showPromoteAction = false,
  onPromoteProfile,
}: RadarSegmentProfilesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-lg flex-col sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Perfis do segmento{segmentName ? `: ${segmentName}` : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!isLoading && profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum perfil neste segmento.</p>
          ) : (
            <RadarSegmentProfilesList
              profiles={profiles}
              isLoading={isLoading}
              page={page}
              total={total}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onViewProfile={onViewProfile}
              showPromoteAction={showPromoteAction}
              onPromoteProfile={onPromoteProfile}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
