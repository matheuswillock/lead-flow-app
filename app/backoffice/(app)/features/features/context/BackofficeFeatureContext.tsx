"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { IBackofficeFeatureService } from "../services/IBackofficeFeatureService"
import type { AccessRuleFormEntry, BackofficeFeatureFormData, BackofficeFeatureItem } from "./BackofficeFeatureTypes"
import { EMPTY_FEATURE_FORM } from "./BackofficeFeatureTypes"
import { toast } from "sonner"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"

const DEFAULT_ACCESS_RULES: AccessRuleFormEntry[] = [
  { principal: "MASTER", accessLevel: "FULL" },
  { principal: "MANAGER", accessLevel: "FULL" },
  { principal: "BACKOFFICE", accessLevel: "FULL" },
  { principal: "OPERATOR", accessLevel: "NONE" },
  { principal: "SDR", accessLevel: "NONE" },
  { principal: "CLOSER", accessLevel: "NONE" },
  { principal: "CAN_MANAGE_TEAMS", accessLevel: "FULL" },
  { principal: "CAN_CREATE_USERS", accessLevel: "FULL" },
]

interface FeatureContextValue {
  features: BackofficeFeatureItem[]
  isLoading: boolean
  canManage: boolean

  dialogOpen: boolean
  dialogMode: "create" | "edit"
  dialogFeature: BackofficeFeatureItem | null
  formData: BackofficeFeatureFormData
  isSaving: boolean
  openCreateDialog: () => void
  openEditDialog: (feature: BackofficeFeatureItem) => void
  closeDialog: () => void
  setFormField: (
    field: keyof BackofficeFeatureFormData,
    value: string | boolean | AccessRuleFormEntry[]
  ) => void
  setAccessRule: (principal: string, accessLevel: string) => void
  submitForm: () => Promise<void>

  deleteDialogOpen: boolean
  deleteFeature: BackofficeFeatureItem | null
  isDeleting: boolean
  openDeleteDialog: (feature: BackofficeFeatureItem) => void
  closeDeleteDialog: () => void
  confirmDelete: () => Promise<void>
}

const BackofficeFeatureContext = createContext<FeatureContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  featureService: IBackofficeFeatureService
}

export function BackofficeFeatureProvider({ children, featureService }: Props) {
  const { user } = useBackofficeUser()
  const canManage = !user?.isOperator
  const [features, setFeatures] = useState<BackofficeFeatureItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [dialogFeature, setDialogFeature] = useState<BackofficeFeatureItem | null>(null)
  const [formData, setFormData] = useState<BackofficeFeatureFormData>(EMPTY_FEATURE_FORM)
  const [isSaving, setIsSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteFeature, setDeleteFeature] = useState<BackofficeFeatureItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const inFlight = useRef(false)

  const loadFeatures = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    try {
      const items = await featureService.list()
      setFeatures(items)
    } catch (err) {
      console.error("[BackofficeFeatureContext]", err)
      toast.error("Erro ao carregar funcionalidades")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [featureService])

  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  const openCreateDialog = useCallback(() => {
    setDialogMode("create")
    setDialogFeature(null)
    setFormData({
      ...EMPTY_FEATURE_FORM,
      accessRules: DEFAULT_ACCESS_RULES.map((rule) => ({ ...rule })),
    })
    setDialogOpen(true)
  }, [])

  const openEditDialog = useCallback((feature: BackofficeFeatureItem) => {
    setDialogMode("edit")
    setDialogFeature(feature)
    setFormData({
      name: feature.name,
      description: feature.description ?? "",
      accessMode: feature.accessMode,
      defaultAccessLevel: feature.defaultAccessLevel,
      betaEnabled: feature.betaEnabled,
      inheritParentSettings: feature.inheritParentSettings,
      isActive: feature.isActive,
      sortOrder: String(feature.sortOrder),
      productSlug: feature.productSlug ?? "",
      parentId: feature.parentId ?? "",
      accessRules:
        feature.accessRules.length > 0
          ? feature.accessRules.map((rule) => ({ ...rule }))
          : DEFAULT_ACCESS_RULES.map((rule) => ({ ...rule })),
    })
    setDialogOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    if (!isSaving) setDialogOpen(false)
  }, [isSaving])

  const setFormField = useCallback(
    (
      field: keyof BackofficeFeatureFormData,
      value: string | boolean | AccessRuleFormEntry[]
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    []
  )

  const setAccessRule = useCallback((principal: string, accessLevel: string) => {
    setFormData((prev) => {
      const existing = prev.accessRules.find((rule) => rule.principal === principal)
      if (existing) {
        return {
          ...prev,
          accessRules: prev.accessRules.map((rule) =>
            rule.principal === principal ? { ...rule, accessLevel } : rule
          ),
        }
      }
      return {
        ...prev,
        accessRules: [...prev.accessRules, { principal, accessLevel }],
      }
    })
  }, [])

  const submitForm = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      if (dialogMode === "create") {
        const created = await featureService.create(formData)
        setFeatures((prev) => [...prev, created])
        toast.success("Funcionalidade criada com sucesso")
      } else if (dialogFeature) {
        const updated = await featureService.update(dialogFeature.id, formData)
        setFeatures((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
        toast.success("Funcionalidade atualizada com sucesso")
      }
      setDialogOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar funcionalidade"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }, [dialogMode, dialogFeature, formData, isSaving, featureService])

  const openDeleteDialog = useCallback((feature: BackofficeFeatureItem) => {
    setDeleteFeature(feature)
    setDeleteDialogOpen(true)
  }, [])

  const closeDeleteDialog = useCallback(() => {
    if (!isDeleting) setDeleteDialogOpen(false)
  }, [isDeleting])

  const confirmDelete = useCallback(async () => {
    if (!deleteFeature || isDeleting) return
    setIsDeleting(true)
    try {
      await featureService.delete(deleteFeature.id)
      setFeatures((prev) => prev.filter((f) => f.id !== deleteFeature.id))
      setDeleteDialogOpen(false)
      toast.success("Funcionalidade excluída com sucesso")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir funcionalidade"
      toast.error(message)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteFeature, isDeleting, featureService])

  return (
    <BackofficeFeatureContext.Provider
      value={{
        features,
        isLoading,
        canManage,
        dialogOpen,
        dialogMode,
        dialogFeature,
        formData,
        isSaving,
        openCreateDialog,
        openEditDialog,
        closeDialog,
        setFormField,
        setAccessRule,
        submitForm,
        deleteDialogOpen,
        deleteFeature,
        isDeleting,
        openDeleteDialog,
        closeDeleteDialog,
        confirmDelete,
      }}
    >
      {children}
    </BackofficeFeatureContext.Provider>
  )
}

export function useBackofficeFeature(): FeatureContextValue {
  const ctx = useContext(BackofficeFeatureContext)
  if (!ctx) throw new Error("useBackofficeFeature must be used within BackofficeFeatureProvider")
  return ctx
}
