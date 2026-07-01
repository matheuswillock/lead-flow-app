"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DispatchPreviewData } from "./AnalyticsTypes"

type DispatchEmailPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: DispatchPreviewData | null
}

export function DispatchEmailPreviewDialog({
  open,
  onOpenChange,
  preview,
}: DispatchEmailPreviewDialogProps) {
  const htmlContent = preview?.html?.trim()
    ? preview.html
    : '<div style="display:flex;align-items:center;justify-content:center;height:100%;min-height:360px;color:#8a8a8a;font-family:sans-serif;font-size:14px;">Sem HTML para renderizar</div>'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base">
              {preview?.subject ?? "Prévia do e-mail"}
            </DialogTitle>
            {preview ? (
              <Badge variant="outline">
                Versão {preview.templateVersionNumber}.0
              </Badge>
            ) : null}
          </div>
          {preview?.templateName ? (
            <p className="text-xs text-muted-foreground">{preview.templateName}</p>
          ) : null}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Alert className="shrink-0 border-warning/30 bg-warning/10">
            <AlertTriangle data-icon="inline-start" className="text-warning" />
            <AlertDescription className="text-xs text-muted-foreground">
              A prévia usa um navegador completo; o e-mail real pode renderizar diferente.
            </AlertDescription>
          </Alert>
          <div className="min-h-[min(60vh,480px)] flex-1 overflow-hidden rounded-lg border bg-background">
            <iframe
              srcDoc={htmlContent}
              title="Prévia do e-mail do disparo"
              sandbox="allow-same-origin"
              className="size-full border-0 bg-background"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
