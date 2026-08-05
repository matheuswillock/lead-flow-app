"use client"

import { useEffect, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { useTeamContext } from "@/app/context/TeamContext"
import { useParams } from "next/navigation"
import { radarImportService } from "../../services/RadarImportService"
import { RadarImportDialog } from "./RadarImportDialog"

type RadarImportButtonProps = {
  mutationLock?: boolean
  onImportComplete?: () => void
}

export function RadarImportButton({ mutationLock, onImportComplete }: RadarImportButtonProps) {
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const { activeTeamId } = useTeamContext()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeImportId, setActiveImportId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<{ processed: number; total: number; status: string } | null>(
    null
  )

  useEffect(() => {
    if (!activeImportId || !supabaseId || !activeTeamId) return

    let cancelled = false
    const poll = async () => {
      try {
        const status = await radarImportService.getJobStatus(supabaseId, activeTeamId, activeImportId)
        if (cancelled) return

        setJobProgress({
          processed: status.processedRows,
          total: status.totalRows,
          status: status.status,
        })

        if (status.status === "completed" || status.status === "completed_with_errors" || status.status === "failed") {
          setActiveImportId(null)
          onImportComplete?.()
        }
      } catch (error) {
        console.error("[RadarImportButton][poll]", error)
      }
    }

    void poll()
    const interval = window.setInterval(() => void poll(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeImportId, activeTeamId, onImportComplete, supabaseId])

  const progressPercent =
    jobProgress && jobProgress.total > 0
      ? Math.min(100, Math.round((jobProgress.processed / jobProgress.total) * 100))
      : 0

  return (
    <div className="flex flex-col gap-2">
      {jobProgress ? (
        <Alert>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              Importação em andamento ({jobProgress.processed}/{jobProgress.total} linhas) —{" "}
              {jobProgress.status}
            </span>
            <Progress value={progressPercent} />
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        disabled={mutationLock}
        onClick={() => setDialogOpen(true)}
      >
        <Upload data-icon="inline-start" />
        Importar base
      </Button>

      <RadarImportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supabaseId={supabaseId}
        teamId={activeTeamId}
        onImportQueued={(importId) => {
          setActiveImportId(importId)
          setJobProgress({ processed: 0, total: 0, status: "pending" })
        }}
      />
    </div>
  )
}
