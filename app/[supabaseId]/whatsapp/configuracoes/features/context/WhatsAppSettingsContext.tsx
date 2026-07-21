"use client"

import { createContext, useContext } from 'react'
import { useWhatsAppSettings } from './WhatsAppSettingsHook'
import type { WhatsAppSettingsContextValue } from './WhatsAppSettingsTypes'

const WhatsAppSettingsCtx = createContext<WhatsAppSettingsContextValue | null>(null)

export function WhatsAppSettingsContext({
  supabaseId,
  children,
}: {
  supabaseId: string
  children: React.ReactNode
}) {
  const value = useWhatsAppSettings(supabaseId)
  return <WhatsAppSettingsCtx.Provider value={value}>{children}</WhatsAppSettingsCtx.Provider>
}

export function useWhatsAppSettingsContext(): WhatsAppSettingsContextValue {
  const ctx = useContext(WhatsAppSettingsCtx)
  if (!ctx) throw new Error('useWhatsAppSettingsContext must be used inside WhatsAppSettingsContext')
  return ctx
}
