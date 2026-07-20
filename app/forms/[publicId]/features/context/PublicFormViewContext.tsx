"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePublicFormView } from "./PublicFormViewHook"
import type { PublicFormViewState } from "./PublicFormViewTypes"

const PublicFormViewContext = createContext<PublicFormViewState | null>(null)

export function PublicFormViewProvider({
  publicId,
  children,
}: {
  publicId: string
  children: ReactNode
}) {
  const value = usePublicFormView(publicId)
  return <PublicFormViewContext.Provider value={value}>{children}</PublicFormViewContext.Provider>
}

export function usePublicFormViewContext(): PublicFormViewState {
  const ctx = useContext(PublicFormViewContext)
  if (!ctx) throw new Error("usePublicFormViewContext must be used within PublicFormViewProvider")
  return ctx
}
