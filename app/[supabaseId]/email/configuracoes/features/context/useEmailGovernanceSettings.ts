"use client"

import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import type { IEmailSettingsService } from "../services/IEmailSettingsService"
import type { BlockedDateRange, EmailSettings } from "./EmailSettingsTypes"

type GovernanceSettingsService = Pick<IEmailSettingsService, "update">

export function useEmailGovernanceSettings(service: GovernanceSettingsService) {
  const [saving, setSaving] = useState(false)
  const [dispatchBlockedDates, setDispatchBlockedDates] = useState<BlockedDateRange[]>([])
  const [dispatchTimeFrom, setDispatchTimeFrom] = useState("")
  const [dispatchTimeTo, setDispatchTimeTo] = useState("")
  const [blockedDispatchDays, setBlockedDispatchDays] = useState<number[]>([])
  const [dispatchAllowedRoles, setDispatchAllowedRoles] = useState<string[]>(["manager", "backoffice"])
  const [templateCreateRoles, setTemplateCreateRoles] = useState<string[]>(["manager", "backoffice"])
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false)
  const [templateApprovalRoles, setTemplateApprovalRoles] = useState<string[]>(["manager", "backoffice"])

  const apply = useCallback((settings: EmailSettings) => {
    setDispatchBlockedDates(settings.dispatchBlockedDates ?? [])
    setDispatchTimeFrom(settings.dispatchTimeFrom ?? "")
    setDispatchTimeTo(settings.dispatchTimeTo ?? "")
    setBlockedDispatchDays(settings.blockedDispatchDays ?? [])
    setDispatchAllowedRoles(settings.dispatchAllowedRoles ?? ["manager", "backoffice"])
    setTemplateCreateRoles(settings.templateCreateRoles ?? ["manager", "backoffice"])
    setTemplateApprovalRequired(settings.templateApprovalRequired ?? false)
    setTemplateApprovalRoles(settings.templateApprovalRoles ?? ["manager", "backoffice"])
  }, [])

  const save = useCallback(async (): Promise<EmailSettings | null> => {
    if (dispatchAllowedRoles.length === 0) {
      toast.error("Pelo menos uma role deve ter permissão de disparo")
      return null
    }
    if (templateCreateRoles.length === 0) {
      toast.error("Pelo menos uma role deve poder criar templates")
      return null
    }
    if (templateApprovalRequired && templateApprovalRoles.length === 0) {
      toast.error("Selecione pelo menos uma role aprovadora")
      return null
    }

    setSaving(true)
    try {
      return await service.update({
        dispatchBlockedDates: dispatchBlockedDates.length > 0 ? dispatchBlockedDates : null,
        dispatchTimeFrom: dispatchTimeFrom.trim() || null,
        dispatchTimeTo: dispatchTimeTo.trim() || null,
        dispatchAllowedRoles,
        templateCreateRoles,
        templateApprovalRequired,
        templateApprovalRoles,
        blockedDispatchDays: blockedDispatchDays.length > 0 ? blockedDispatchDays : null,
      })
    } catch (error) {
      console.error("[useEmailGovernanceSettings] save", error)
      toast.error("Erro ao salvar configurações")
      return null
    } finally {
      setSaving(false)
    }
  }, [blockedDispatchDays, dispatchAllowedRoles, dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo, service, templateApprovalRequired, templateApprovalRoles, templateCreateRoles])

  const addBlockedDate = useCallback((entry: BlockedDateRange) => {
    setDispatchBlockedDates((current) => [...current, entry])
  }, [])
  const removeBlockedDate = useCallback((index: number) => {
    setDispatchBlockedDates((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }, [])
  const toggleBlockedDispatchDay = useCallback((day: number) => {
    setBlockedDispatchDays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day].sort((left, right) => left - right))
  }, [])
  const toggleDispatchRole = useCallback((role: string) => {
    setDispatchAllowedRoles((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role])
  }, [])
  const toggleTemplateCreateRole = useCallback((role: string) => {
    setTemplateCreateRoles((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role])
  }, [])
  const toggleTemplateApprovalRole = useCallback((role: string) => {
    setTemplateApprovalRoles((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role])
  }, [])
  const hasChanges = useCallback((settings: EmailSettings | null) => {
    if (!settings) return false
    return JSON.stringify({ dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo, blockedDispatchDays, dispatchAllowedRoles, templateCreateRoles, templateApprovalRequired, templateApprovalRoles }) !== JSON.stringify({
      dispatchBlockedDates: settings.dispatchBlockedDates ?? [],
      dispatchTimeFrom: settings.dispatchTimeFrom ?? "",
      dispatchTimeTo: settings.dispatchTimeTo ?? "",
      blockedDispatchDays: settings.blockedDispatchDays ?? [],
      dispatchAllowedRoles: settings.dispatchAllowedRoles,
      templateCreateRoles: settings.templateCreateRoles,
      templateApprovalRequired: settings.templateApprovalRequired,
      templateApprovalRoles: settings.templateApprovalRoles,
    })
  }, [blockedDispatchDays, dispatchAllowedRoles, dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo, templateApprovalRequired, templateApprovalRoles, templateCreateRoles])

  return useMemo(() => ({
    saving,
    dispatchBlockedDates,
    dispatchTimeFrom,
    dispatchTimeTo,
    blockedDispatchDays,
    dispatchAllowedRoles,
    templateCreateRoles,
    templateApprovalRequired,
    templateApprovalRoles,
    setDispatchTimeFrom,
    setDispatchTimeTo,
    setTemplateApprovalRequired,
    addBlockedDate,
    removeBlockedDate,
    toggleBlockedDispatchDay,
    toggleDispatchRole,
    toggleTemplateCreateRole,
    toggleTemplateApprovalRole,
    apply,
    save,
    hasChanges,
  }), [addBlockedDate, apply, blockedDispatchDays, dispatchAllowedRoles, dispatchBlockedDates, dispatchTimeFrom, dispatchTimeTo, hasChanges, removeBlockedDate, save, saving, templateApprovalRequired, templateApprovalRoles, templateCreateRoles, toggleBlockedDispatchDay, toggleDispatchRole, toggleTemplateApprovalRole])
}
