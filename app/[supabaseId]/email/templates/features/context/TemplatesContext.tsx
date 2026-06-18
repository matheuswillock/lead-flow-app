'use client'

import { createContext, ReactNode, useContext } from 'react'
import type { Template, TemplatesState, TemplateTab } from './TemplatesTypes'
import { useTemplates } from './TemplatesHook'

interface ITemplatesContext extends TemplatesState {
  fetchTemplates: () => Promise<void>
  setActiveTab: (tab: TemplateTab) => void
  activeRole: 'manager' | 'backoffice' | 'operator' | null
  handleDelete: (id: string) => Promise<void>
  handleDuplicate: (id: string) => Promise<void>
  handleSubmitForApproval: (id: string) => Promise<void>
  handleApprove: (id: string) => Promise<void>
  handleReject: (id: string, reviewNote: string) => Promise<void>
}

const TemplatesContext = createContext<ITemplatesContext | undefined>(undefined)

interface TemplatesProviderProps {
  children: ReactNode
  supabaseId: string
}

export function TemplatesProvider({ children, supabaseId }: TemplatesProviderProps) {
  const value = useTemplates(supabaseId)

  return (
    <TemplatesContext.Provider value={value}>
      {children}
    </TemplatesContext.Provider>
  )
}

export function useTemplatesContext(): ITemplatesContext {
  const context = useContext(TemplatesContext)
  if (!context) {
    throw new Error('useTemplatesContext must be used within a TemplatesProvider')
  }
  return context
}

export type { Template }
