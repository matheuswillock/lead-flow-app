"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { AlertTriangle, Info, Lightbulb } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useTemplateEditorContext } from "../context/TemplateEditorContext"
import { useTeamContext } from "@/app/context/TeamContext"
import { createTemplateEditorService } from "../services/TemplateEditorService"
import {
  analyzeEmailHtml,
  EMAIL_CREATION_STATIC_TIPS,
  type EmailCreationStaticTip,
  type EmailHtmlAlert,
} from "../utils/analyze-email-html"

const settingsService = createTemplateEditorService()

function TipCard({
  tip,
}: {
  tip: EmailHtmlAlert | EmailCreationStaticTip
}) {
  const Icon = tip.severity === "warning" ? AlertTriangle : Info

  return (
    <article className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        <Icon
          data-icon="inline-start"
          className={tip.severity === "warning" ? "mt-0.5 text-warning" : "mt-0.5 text-muted-foreground"}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">{tip.title}</h4>
            <Badge variant="outline" className="text-[10px]">
              {tip.severity === "warning" ? "Atenção" : "Dica"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{tip.message}</p>
        </div>
      </div>
      {tip.detail ? (
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-[11px] text-foreground">
          {tip.detail}
        </pre>
      ) : null}
    </article>
  )
}

interface EmailCreationTipsPanelProps {
  embedded?: boolean
}

export function EmailCreationTipsPanel({ embedded = false }: EmailCreationTipsPanelProps) {
  const { draft } = useTemplateEditorContext()
  const params = useParams<{ supabaseId: string }>()
  const supabaseId = params.supabaseId
  const { activeTeamId } = useTeamContext()
  const [fromEmail, setFromEmail] = useState<string | null>(null)
  const fetchedSettingsRef = useRef(false)

  useEffect(() => {
    if (!activeTeamId || fetchedSettingsRef.current) return
    fetchedSettingsRef.current = true

    void settingsService
      .getEmailSettingsForTips(supabaseId, activeTeamId)
      .then((settings) => setFromEmail(settings.fromEmail))
      .catch(() => setFromEmail(null))
  }, [activeTeamId, supabaseId])

  const sendingDomain = useMemo(() => {
    if (!fromEmail?.includes("@")) return null
    return fromEmail.split("@")[1] ?? null
  }, [fromEmail])

  const htmlAlerts = useMemo(
    () => analyzeEmailHtml(draft.html, sendingDomain),
    [draft.html, sendingDomain]
  )

  const staticTips = useMemo(() => {
    const htmlAlertIds = new Set(htmlAlerts.map((alert) => alert.id))
    return EMAIL_CREATION_STATIC_TIPS.filter((tip) => {
      if (tip.id === "image-formats" && htmlAlertIds.has("inline-svg")) return false
      if (tip.id === "no-reply-sender" && htmlAlertIds.has("no-reply-in-content")) return false
      return true
    })
  }, [htmlAlerts])

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

      {htmlAlerts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Precisa de atenção
          </p>
          {htmlAlerts.map((alert) => (
            <TipCard key={alert.id} tip={alert} />
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Boas práticas
        </p>
        {staticTips.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </div>
  )
}
