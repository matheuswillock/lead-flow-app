"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { IPublicOfferService } from "../services/IPublicOfferService"
import { PublicOfferService } from "../services/PublicOfferService"
import type { PublicOfferShare } from "./PublicOfferTypes"

interface PublicOfferContextValue {
  token: string
  share: PublicOfferShare | null
  isLoading: boolean
  error: string | null
}

const PublicOfferContext = createContext<PublicOfferContextValue | null>(null)

export function PublicOfferProvider({
  children,
  token,
}: {
  children: ReactNode
  token: string
}) {
  const service = useMemo<IPublicOfferService>(() => new PublicOfferService(), [])
  const [share, setShare] = useState<PublicOfferShare | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlightKey = useRef<string | null>(null)
  const lastSuccessKey = useRef<string | null>(null)

  const loadShare = useCallback(async () => {
    const requestKey = `offer-share:${token}`
    if (inFlightKey.current === requestKey || lastSuccessKey.current === requestKey) return

    inFlightKey.current = requestKey
    setIsLoading(true)
    setError(null)
    try {
      const response = await service.getShare(token)
      setShare(response)
      lastSuccessKey.current = requestKey
    } catch (err) {
      console.error("[PublicOfferContext][loadShare]", err)
      setError(err instanceof Error ? err.message : "Link de oferta indisponível")
    } finally {
      setIsLoading(false)
      inFlightKey.current = null
    }
  }, [service, token])

  useEffect(() => {
    void loadShare()
  }, [loadShare])

  return (
    <PublicOfferContext.Provider value={{ token, share, isLoading, error }}>
      {children}
    </PublicOfferContext.Provider>
  )
}

export function usePublicOfferContext(): PublicOfferContextValue {
  const context = useContext(PublicOfferContext)
  if (!context) {
    throw new Error("usePublicOfferContext must be used within PublicOfferProvider")
  }
  return context
}
