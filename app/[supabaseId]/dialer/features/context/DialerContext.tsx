'use client'

import { createContext, ReactNode, useContext } from 'react'
import { useDialer, UseDialerReturn } from './DialerHook'

const DialerContext = createContext<UseDialerReturn | undefined>(undefined)

interface DialerProviderProps {
  children: ReactNode
  supabaseId: string
}

export function DialerProvider({ children, supabaseId }: DialerProviderProps) {
  const value = useDialer(supabaseId)

  return <DialerContext.Provider value={value}>{children}</DialerContext.Provider>
}

export function useDialerContext(): UseDialerReturn {
  const context = useContext(DialerContext)
  if (!context) {
    throw new Error('useDialerContext must be used within a DialerProvider')
  }
  return context
}
