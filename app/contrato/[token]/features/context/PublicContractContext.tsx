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
import { toUserToastMessage, toastUserError } from "@/lib/ui/to-user-toast-message"
import type { IPublicContractService } from "../services/IPublicContractService"
import { PublicContractService } from "../services/PublicContractService"
import type { PublicContractShare } from "./PublicContractTypes"

interface PublicContractContextValue {
  token: string
  share: PublicContractShare | null
  isLoading: boolean
  isDownloading: boolean
  error: string | null
  downloadContract: () => Promise<void>
}

const PublicContractContext = createContext<PublicContractContextValue | null>(null)

export function PublicContractProvider({
  children,
  token,
  initialShare,
}: {
  children: ReactNode
  token: string
  /** Dados pré-carregados pelo Server Component — evita requisição visível no Network. */
  initialShare?: PublicContractShare | null
}) {
  const service = useMemo<IPublicContractService>(() => new PublicContractService(), [])
  const [share, setShare] = useState<PublicContractShare | null>(initialShare ?? null)
  const [isLoading, setIsLoading] = useState(!initialShare)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightKey = useRef<string | null>(null)
  const lastSuccessKey = useRef<string | null>(initialShare ? `share:${token}` : null)

  const loadShare = useCallback(async () => {
    const requestKey = `share:${token}`
    if (inFlightKey.current === requestKey || lastSuccessKey.current === requestKey) return

    inFlightKey.current = requestKey
    setIsLoading(true)
    setError(null)
    try {
      const response = await service.getShare(token)
      setShare(response)
      lastSuccessKey.current = requestKey
    } catch (err) {
      console.error("[PublicContractContext][loadShare]", err)
      setError(toUserToastMessage(err))
    } finally {
      setIsLoading(false)
      inFlightKey.current = null
    }
  }, [service, token])

  const downloadContract = useCallback(async () => {
    if (isDownloading) return

    const downloadWindow = window.open("about:blank", "_blank")
    if (downloadWindow) {
      downloadWindow.opener = null
    }

    setIsDownloading(true)
    try {
      const download = await service.getDownloadUrl(token)
      if (downloadWindow) {
        downloadWindow.location.href = download.downloadUrl
      } else {
        window.open(download.downloadUrl, "_blank", "noopener,noreferrer")
      }
    } catch (err) {
      downloadWindow?.close()
      console.error("[PublicContractContext][downloadContract]", err)
      toastUserError(err)
    } finally {
      setIsDownloading(false)
    }
  }, [isDownloading, service, token])

  useEffect(() => {
    void loadShare()
  }, [loadShare])

  return (
    <PublicContractContext.Provider
      value={{ token, share, isLoading, isDownloading, error, downloadContract }}
    >
      {children}
    </PublicContractContext.Provider>
  )
}

export function usePublicContractContext(): PublicContractContextValue {
  const context = useContext(PublicContractContext)
  if (!context) {
    throw new Error("usePublicContractContext must be used within PublicContractProvider")
  }
  return context
}
