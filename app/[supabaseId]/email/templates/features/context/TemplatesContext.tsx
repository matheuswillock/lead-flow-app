'use client'

import { createContext, ReactNode, useContext } from 'react'
import { Template, TemplatesState } from './TemplatesTypes'
import { useTemplates } from './TemplatesHook'

interface ITemplatesContext extends TemplatesState {
  fetchTemplates: () => Promise<void>
  handleDelete: (id: string) => Promise<void>
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

// Re-export Template type for convenience
export type { Template }
