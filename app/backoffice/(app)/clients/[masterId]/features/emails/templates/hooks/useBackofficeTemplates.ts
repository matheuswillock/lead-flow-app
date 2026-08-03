"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { backofficeStudioEmailService } from "../../services/BackofficeStudioEmailService"
import type { StudioEmailTemplate } from "../../services/IBackofficeStudioEmailService"

export type BackofficeTemplateTab = "draft" | "published" | "pending_approval"

export function useBackofficeTemplates(
  masterId: string,
  teamId: string | null,
  refreshKey: number
) {
  const router = useRouter()
  const [templates, setTemplates] = useState<StudioEmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<BackofficeTemplateTab>("draft")
  const inFlightRef = useRef(false)
  const lastKeyRef = useRef("")

  const fetchTemplates = useCallback(async () => {
    if (!teamId) {
      setTemplates([])
      return
    }
    const key = `${masterId}:${teamId}:${refreshKey}`
    if (inFlightRef.current || lastKeyRef.current === key) return

    inFlightRef.current = true
    setLoading(true)
    try {
      const list = await backofficeStudioEmailService.listTemplates(masterId, teamId, {
        scope: "workbench",
        approvalFilter: "all",
      })
      setTemplates(list)
      lastKeyRef.current = key
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar templates")
    } finally {
      setLoading(false)
      inFlightRef.current = false
    }
  }, [masterId, refreshKey, teamId])

  useEffect(() => {
    lastKeyRef.current = ""
    void fetchTemplates()
  }, [fetchTemplates])

  const createTemplate = useCallback(
    async (name: string, subject: string) => {
      if (!teamId || creating) return
      setCreating(true)
      try {
        const created = await backofficeStudioEmailService.createTemplate(masterId, teamId, {
          name,
          subject,
        })
        toast.success("Template criado")
        router.push(
          `/backoffice/clients/${masterId}/emails/templates/${created.id}?teamId=${teamId}`
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar template")
      } finally {
        setCreating(false)
      }
    },
    [creating, masterId, router, teamId]
  )

  const tabFiltered = templates.filter((template) => {
    if (activeTab === "draft") {
      return template.status === "draft" && template.approvalStatus !== "pending_approval"
    }
    if (activeTab === "published") return template.status === "published"
    if (activeTab === "pending_approval") return template.approvalStatus === "pending_approval"
    return true
  })

  return {
    templates: tabFiltered,
    allTemplates: templates,
    loading,
    creating,
    activeTab,
    setActiveTab,
    createTemplate,
    refresh: fetchTemplates,
  }
}
