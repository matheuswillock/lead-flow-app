"use client"

import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import { toast } from "sonner"
import type { IBackofficeLeadExtractionFrontendService, LeadExtractionResultItem } from "../services/IBackofficeLeadExtractionService"
import { EMPTY_FILTERS, type BackofficeLeadExtractionContextValue } from "./BackofficeLeadExtractionTypes"
import type { LeadExtractionFiltersForm } from "../services/IBackofficeLeadExtractionService"

const BackofficeLeadExtractionContext = createContext<BackofficeLeadExtractionContextValue | null>(null)

interface Props {
  children: React.ReactNode
  service: IBackofficeLeadExtractionFrontendService
}

export function BackofficeLeadExtractionProvider({ children, service }: Props) {
  const [filters, setFilters] = useState<LeadExtractionFiltersForm>(EMPTY_FILTERS)
  const [results, setResults] = useState<LeadExtractionResultItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inFlightRef = useRef(false)

  const handleSearch = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsSearching(true)

    try {
      const data = await service.search(filters)
      setResults(data.items)
      setTotalCount(data.totalCount)
      setExtractionId(data.extractionId)
      setHasSearched(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao realizar extração"
      toast.error(message)
    } finally {
      setIsSearching(false)
      inFlightRef.current = false
    }
  }, [filters, service])

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
  }, [])

  return (
    <BackofficeLeadExtractionContext.Provider
      value={{
        filters,
        setFilters,
        results,
        totalCount,
        extractionId,
        isSearching,
        hasSearched,
        handleSearch,
        clearFilters,
        searchCnaes: service.searchCnaes.bind(service),
      }}
    >
      {children}
    </BackofficeLeadExtractionContext.Provider>
  )
}

export function useBackofficeLeadExtraction(): BackofficeLeadExtractionContextValue {
  const ctx = useContext(BackofficeLeadExtractionContext)
  if (!ctx) {
    throw new Error("useBackofficeLeadExtraction must be used within BackofficeLeadExtractionProvider")
  }
  return ctx
}
