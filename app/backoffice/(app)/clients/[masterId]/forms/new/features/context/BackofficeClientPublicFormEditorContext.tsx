"use client"

import { createContext, useContext, type ReactNode } from "react"
import { backofficeClientPublicFormEditorService } from "../services/BackofficeClientPublicFormEditorService"
import { useBackofficeClientPublicFormEditor } from "./BackofficeClientPublicFormEditorHook"
import type { BackofficeClientPublicFormEditorContextValue } from "./BackofficeClientPublicFormEditorTypes"

const BackofficeClientPublicFormEditorContext =
  createContext<BackofficeClientPublicFormEditorContextValue | null>(null)

export function BackofficeClientPublicFormEditorProvider({
  masterId,
  teamId,
  formId,
  children,
}: {
  masterId: string
  teamId: string | null
  formId?: string
  children: ReactNode
}) {
  const value = useBackofficeClientPublicFormEditor(
    masterId,
    teamId,
    formId,
    backofficeClientPublicFormEditorService
  )
  return (
    <BackofficeClientPublicFormEditorContext.Provider value={value}>
      {children}
    </BackofficeClientPublicFormEditorContext.Provider>
  )
}

export function useBackofficeClientPublicFormEditorContext() {
  const ctx = useContext(BackofficeClientPublicFormEditorContext)
  if (!ctx) {
    throw new Error(
      "useBackofficeClientPublicFormEditorContext must be used within provider"
    )
  }
  return ctx
}
