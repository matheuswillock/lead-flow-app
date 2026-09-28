"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import type { IEmailSettingsService, UpsertEmailVariableData } from "../services/IEmailSettingsService"
import type { EmailGlobalVariable } from "./EmailSettingsTypes"

type ContentSettingsService = Pick<IEmailSettingsService, "createVariable" | "updateVariable" | "deleteVariable">

export function useEmailContentSettings(service: ContentSettingsService) {
  const [globalVariables, setGlobalVariables] = useState<EmailGlobalVariable[]>([])
  const [creatingVariable, setCreatingVariable] = useState(false)
  const [updatingVariableId, setUpdatingVariableId] = useState<string | null>(null)
  const [deletingVariableId, setDeletingVariableId] = useState<string | null>(null)

  const apply = useCallback((variables: EmailGlobalVariable[]) => setGlobalVariables(variables), [])
  const handleCreateVariable = useCallback(async (data: UpsertEmailVariableData) => {
    setCreatingVariable(true)
    try {
      const created = await service.createVariable(data)
      setGlobalVariables((current) => [...current, created].sort((left, right) => left.key.localeCompare(right.key)))
      toast.success("Variável global criada com sucesso")
    } catch (error) {
      console.error("[useEmailContentSettings] createVariable", error)
      toastUserError(error)
      throw error
    } finally {
      setCreatingVariable(false)
    }
  }, [service])
  const handleUpdateVariable = useCallback(async (variableId: string, data: UpsertEmailVariableData) => {
    setUpdatingVariableId(variableId)
    try {
      const updated = await service.updateVariable(variableId, data)
      setGlobalVariables((current) => current
        .map((variable) => variable.id === variableId ? updated : variable)
        .sort((left, right) => left.key.localeCompare(right.key)))
      toast.success("Variável global atualizada com sucesso")
    } catch (error) {
      console.error("[useEmailContentSettings] updateVariable", error)
      toastUserError(error)
      throw error
    } finally {
      setUpdatingVariableId(null)
    }
  }, [service])
  const handleDeleteVariable = useCallback(async (variableId: string) => {
    setDeletingVariableId(variableId)
    try {
      await service.deleteVariable(variableId)
      setGlobalVariables((current) => current.filter((variable) => variable.id !== variableId))
      toast.success("Variável global removida com sucesso")
    } catch (error) {
      console.error("[useEmailContentSettings] deleteVariable", error)
      toastUserError(error)
    } finally {
      setDeletingVariableId(null)
    }
  }, [service])

  return { globalVariables, creatingVariable, updatingVariableId, deletingVariableId, apply, handleCreateVariable, handleUpdateVariable, handleDeleteVariable }
}
