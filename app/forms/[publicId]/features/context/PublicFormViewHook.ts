"use client"

import { useEffect, useRef, useState } from "react"
import { publicFormViewService } from "../services/PublicFormViewService"
import type { PublicFormViewState } from "./PublicFormViewTypes"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"

export function usePublicFormView(
  publicId: string,
  initialSnapshot?: PublicFormSnapshot | null,
): PublicFormViewState {
  const [snapshot, setSnapshot] = useState<PublicFormViewState["snapshot"]>(initialSnapshot ?? null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(!initialSnapshot)
  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(initialSnapshot ? publicId : null)

  useEffect(() => {
    const requestKey = publicId
    if (!requestKey) return
    if (inFlightKeyRef.current === requestKey || lastSuccessKeyRef.current === requestKey) return

    inFlightKeyRef.current = requestKey
    setIsLoading(true)
    setError(null)

    void publicFormViewService
      .getSnapshot(requestKey)
      .then((result) => {
        setSnapshot(result)
        lastSuccessKeyRef.current = requestKey
      })
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : "Formulário indisponível")
      })
      .finally(() => {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
        setIsLoading(false)
      })
  }, [publicId])

  return { publicId, snapshot, error, isLoading }
}
