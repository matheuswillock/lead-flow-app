"use client"

import { useEffect, useRef, useState } from "react"
import { publicFormViewService } from "../services/PublicFormViewService"
import type { PublicFormViewState } from "./PublicFormViewTypes"
import type { PublicFormSnapshot } from "@/lib/public-forms/types"
import type { PublicFormLegalNotice } from "@/lib/legal/form-privacy-policy"
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message"

export function usePublicFormView(
  publicId: string,
  initialSnapshot?: PublicFormSnapshot | null,
  initialPublicationId?: string | null,
  initialLegalNotice?: PublicFormLegalNotice | null,
): PublicFormViewState {
  const [legalNotice, setLegalNotice] = useState<PublicFormLegalNotice | null>(initialLegalNotice ?? null)
  const [snapshot, setSnapshot] = useState<PublicFormViewState["snapshot"]>(initialSnapshot ?? null)
  const [publicationId, setPublicationId] = useState<string | null>(initialPublicationId ?? null)
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
        setSnapshot(result.snapshot)
        setPublicationId(result.publicationId)
        setLegalNotice(result.legalNotice ?? null)
        lastSuccessKeyRef.current = requestKey
      })
      .catch((fetchError: unknown) => {
        setError(toUserToastMessage(fetchError))
      })
      .finally(() => {
        if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
        setIsLoading(false)
      })
  }, [publicId])

  return { publicId, publicationId, snapshot, legalNotice, error, isLoading }
}
