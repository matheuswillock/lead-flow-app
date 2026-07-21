"use client"

import { createContext, useContext } from 'react'
import type { WhatsAppAutoResponsesContextValue } from './WhatsAppAutoResponsesTypes'
import { useWhatsAppAutoResponses } from './WhatsAppAutoResponsesHook'

const WhatsAppAutoResponsesCtx = createContext<WhatsAppAutoResponsesContextValue | null>(null)

export function WhatsAppAutoResponsesContext({
  supabaseId,
  children,
}: {
  supabaseId: string
  children: React.ReactNode
}) {
  const value = useWhatsAppAutoResponses(supabaseId)
  return <WhatsAppAutoResponsesCtx.Provider value={value}>{children}</WhatsAppAutoResponsesCtx.Provider>
}

export function useWhatsAppAutoResponsesContext(): WhatsAppAutoResponsesContextValue {
  const context = useContext(WhatsAppAutoResponsesCtx)
  if (!context) {
    throw new Error('useWhatsAppAutoResponsesContext must be used inside WhatsAppAutoResponsesContext')
  }
  return context
}
