"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type {
  IBackofficeEmailTemplatesService,
  TemplateListItem,
  TemplateDetail,
  CreateTemplateFormData,
  UpdateTemplateFormData,
  OperationResult,
} from "../services/IBackofficeEmailTemplatesService"
import type { BackofficeEmailTemplatesContextValue } from "./BackofficeEmailTemplatesTypes"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"

export const BackofficeEmailTemplatesContext = createContext<BackofficeEmailTemplatesContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  templatesService: IBackofficeEmailTemplatesService
}

export function BackofficeEmailTemplatesProvider({ children, templatesService }: Props) {
  const { user } = useBackofficeUser()
  const [templates, setTemplates] = useState<TemplateListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const canManage = user?.fullAccess === true

  const fetchTemplates = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    setError(null)
    try {
      const data = await templatesService.list()
      setTemplates(data)
    } catch (err) {
      console.error("[BackofficeEmailTemplatesContext]", err)
      setError("Erro ao carregar templates de e-mail")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [templatesService])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const getTemplate = useCallback(
    async (id: string): Promise<TemplateDetail | null> => {
      try {
        return await templatesService.get(id)
      } catch (err) {
        console.error("[BackofficeEmailTemplatesContext][get]", err)
        return null
      }
    },
    [templatesService]
  )

  const createTemplate = useCallback(
    async (data: CreateTemplateFormData): Promise<OperationResult> => {
      setIsCreating(true)
      try {
        const result = await templatesService.create(data)
        if (result.isValid) await fetchTemplates()
        return result
      } finally {
        setIsCreating(false)
      }
    },
    [templatesService, fetchTemplates]
  )

  const updateTemplate = useCallback(
    async (id: string, data: UpdateTemplateFormData): Promise<OperationResult> => {
      setIsUpdating(true)
      try {
        const result = await templatesService.update(id, data)
        if (result.isValid) await fetchTemplates()
        return result
      } finally {
        setIsUpdating(false)
      }
    },
    [templatesService, fetchTemplates]
  )

  const removeTemplate = useCallback(
    async (id: string): Promise<OperationResult> => {
      setIsRemoving(true)
      try {
        const result = await templatesService.remove(id)
        if (result.isValid) await fetchTemplates()
        return result
      } finally {
        setIsRemoving(false)
      }
    },
    [templatesService, fetchTemplates]
  )

  const publishTemplate = useCallback(
    async (id: string): Promise<OperationResult> => {
      setIsPublishing(true)
      try {
        const result = await templatesService.publish(id)
        if (result.isValid) await fetchTemplates()
        return result
      } finally {
        setIsPublishing(false)
      }
    },
    [templatesService, fetchTemplates]
  )

  const duplicateTemplate = useCallback(
    async (id: string): Promise<OperationResult> => {
      setIsDuplicating(true)
      try {
        const result = await templatesService.duplicate(id)
        if (result.isValid) await fetchTemplates()
        return result
      } finally {
        setIsDuplicating(false)
      }
    },
    [templatesService, fetchTemplates]
  )

  return (
    <BackofficeEmailTemplatesContext.Provider
      value={{
        templates,
        isLoading,
        isCreating,
        isUpdating,
        isRemoving,
        isPublishing,
        isDuplicating,
        canManage,
        error,
        fetchTemplates,
        getTemplate,
        createTemplate,
        updateTemplate,
        removeTemplate,
        publishTemplate,
        duplicateTemplate,
      }}
    >
      {children}
    </BackofficeEmailTemplatesContext.Provider>
  )
}
