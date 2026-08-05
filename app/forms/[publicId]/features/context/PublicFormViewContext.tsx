"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePublicFormView } from "./PublicFormViewHook"
import type { PublicFormViewState } from "./PublicFormViewTypes"

const PublicFormViewContext = createContext<PublicFormViewState | null>(null)

export function PublicFormViewProvider({
  publicId,
  children,
  initialSnapshot,
}: {
  publicId: string
  children: ReactNode
  /** Snapshot pré-carregado pelo Server Component — evita requisição visível no Network. */
  initialSnapshot?: import("@/lib/public-forms/types").PublicFormSnapshot | null
}) {
  const value = usePublicFormView(publicId, initialSnapshot)
  return <PublicFormViewContext.Provider value={value}>{children}</PublicFormViewContext.Provider>
}

export function usePublicFormViewContext(): PublicFormViewState {
  const ctx = useContext(PublicFormViewContext)
  if (!ctx) throw new Error("usePublicFormViewContext must be used within PublicFormViewProvider")
  return ctx
}
