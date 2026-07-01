"use client"

import { useMemo } from "react"
import { AlertTriangle, Info, Lightbulb } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTemplateEditorContext } from "../context/TemplateEditorContext"
import {
  analyzeEmailHtml,
  EMAIL_CREATION_TIPS,
  type EmailHtmlAlert,
} from "../utils/analyze-email-html"

function AlertItem({ alert }: { alert: EmailHtmlAlert }) {
  const Icon = alert.severity === "warning" ? AlertTriangle : Info
  return (
    <Alert className={alert.severity === "warning" ? "border-warning/30 bg-warning/10" : undefined}>
      <Icon data-icon="inline-start" className={alert.severity === "warning" ? "text-warning" : undefined} />
      <AlertDescription>{alert.message}</AlertDescription>
    </Alert>
  )
}

interface EmailCreationTipsPanelProps {
  embedded?: boolean
}

export function EmailCreationTipsPanel({ embedded = false }: EmailCreationTipsPanelProps) {
  const { draft } = useTemplateEditorContext()

  const alerts = useMemo(() => analyzeEmailHtml(draft.html), [draft.html])

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Dicas de criação</h3>
          <p className="text-xs text-muted-foreground">
            A prévia usa um navegador completo; o e-mail real pode renderizar diferente.
          </p>
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Alertas no HTML atual</p>
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      ) : null}

      <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted-foreground">
        {EMAIL_CREATION_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
    </div>
  )
}
