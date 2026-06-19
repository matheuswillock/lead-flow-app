"use client"

import { createContext, useContext } from 'react'
import { useWhatsAppInbox } from './WhatsAppInboxHook'
import type { InboxState, InboxActions } from './WhatsAppInboxTypes'

type WhatsAppInboxContextValue = InboxState & InboxActions

const WhatsAppInboxContext = createContext<WhatsAppInboxContextValue | null>(null)

interface WhatsAppInboxProviderProps {
  supabaseId: string
  children: React.ReactNode
}

export function WhatsAppInboxProvider({ supabaseId, children }: WhatsAppInboxProviderProps) {
  const value = useWhatsAppInbox(supabaseId)

  return (
    <WhatsAppInboxContext.Provider value={value}>
      {children}
    </WhatsAppInboxContext.Provider>
  )
}

export function useWhatsAppInboxContext(): WhatsAppInboxContextValue {
  const context = useContext(WhatsAppInboxContext)
  if (!context) {
    throw new Error('useWhatsAppInboxContext must be used within a WhatsAppInboxProvider')
  }
  return context
}
