"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePublicFormEdit } from "./PublicFormEditHook"

const PublicFormEditContext = createContext<ReturnType<typeof usePublicFormEdit> | null>(null)

export function PublicFormEditProvider({
  formId,
  children,
}: {
  formId: string
  children: ReactNode
}) {
  const value = usePublicFormEdit(formId)
  return <PublicFormEditContext.Provider value={value}>{children}</PublicFormEditContext.Provider>
}

export function usePublicFormEditContext() {
  const ctx = useContext(PublicFormEditContext)
  if (!ctx) throw new Error("usePublicFormEditContext must be used within PublicFormEditProvider")
  return ctx
}
