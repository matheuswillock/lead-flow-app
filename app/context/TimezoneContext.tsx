"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"
import { toast } from "sonner"
import { detectBrowserTimezone, getTimezoneDisplayName, resolveTimezone } from "@/lib/dates"
import { useAuth } from "./AuthContext"

interface TimezoneContextType {
  tz: string
  setTz: (tz: string) => Promise<void>
  loading: boolean
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined)

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [tz, setTzState] = useState<string>(detectBrowserTimezone)
  const [loading, setLoading] = useState(true)
  const [fetchKey, setFetchKey] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    if (fetchKey === user.id) return
    setFetchKey(user.id)

    const load = async () => {
      try {
        const res = await fetch(`/api/v1/profiles/${user.id}/timezone`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const profileTz = resolveTimezone(data.result?.timezone)
        const browserTz = detectBrowserTimezone()
        const profileTzLabel = getTimezoneDisplayName(profileTz)
        const browserTzLabel = getTimezoneDisplayName(browserTz)

        setTzState(profileTz)

        if (profileTz !== browserTz) {
          toast.info(`Seu horário está configurado para ${profileTzLabel}. Seu navegador usa ${browserTzLabel}.`, {
            action: {
              label: "Usar fuso do navegador",
              onClick: () => setTz(browserTz),
            },
            duration: 8000,
          })
        }
      } catch {
        // silently fall back to browser TZ
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [fetchKey, user?.id])

  const setTz = useCallback(async (newTz: string) => {
    if (!user?.id) return
    const previous = tz
    setTzState(newTz)
    try {
      const res = await fetch(`/api/v1/profiles/${user.id}/timezone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTz }),
      })
      if (!res.ok) throw new Error("Failed to save timezone")
      toast.success("Fuso horário atualizado")
    } catch {
      setTzState(previous)
      toast.error("Erro ao salvar fuso horário")
    }
  }, [user?.id, tz])

  return (
    <TimezoneContext.Provider value={{ tz, setTz, loading }}>
      {children}
    </TimezoneContext.Provider>
  )
}

export function useTimezone(): TimezoneContextType {
  const ctx = useContext(TimezoneContext)
  if (!ctx) throw new Error("useTimezone must be used within TimezoneProvider")
  return ctx
}
