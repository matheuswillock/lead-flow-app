"use client"

import React, { createContext, useCallback, useContext, useRef, useState } from "react"
import { toast } from "sonner"
import type {
  IBackofficeLeadExtractionFrontendService,
  LeadExtractionResultItem,
  LeadExtractionFiltersForm,
  SocioFiltersForm,
  SocioResultItem,
} from "../services/IBackofficeLeadExtractionService"
import { EMPTY_FILTERS, EMPTY_SOCIO_FILTERS, type BackofficeLeadExtractionContextValue } from "./BackofficeLeadExtractionTypes"

const BackofficeLeadExtractionContext = createContext<BackofficeLeadExtractionContextValue | null>(null)

interface Props {
  children: React.ReactNode
  service: IBackofficeLeadExtractionFrontendService
}

export function BackofficeLeadExtractionProvider({ children, service }: Props) {
  const [activeTab, setActiveTab] = useState<"empresas" | "socios">("empresas")

  const [filters, setFilters] = useState<LeadExtractionFiltersForm>(EMPTY_FILTERS)
  const [results, setResults] = useState<LeadExtractionResultItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [extractionId, setExtractionId] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inFlightRef = useRef(false)

  const [socioFilters, setSocioFilters] = useState<SocioFiltersForm>(EMPTY_SOCIO_FILTERS)
  const [socioResults, setSocioResults] = useState<SocioResultItem[]>([])
  const [socioTotalCount, setSocioTotalCount] = useState(0)
  const [isSocioSearching, setIsSocioSearching] = useState(false)
  const [hasSearchedSocios, setHasSearchedSocios] = useState(false)
  const socioInFlightRef = useRef(false)

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

  const handleSocioSearch = useCallback(async () => {
    if (socioInFlightRef.current) return
    socioInFlightRef.current = true
    setIsSocioSearching(true)

    try {
      const data = await service.searchSocios(socioFilters)
      setSocioResults(data.items)
      setSocioTotalCount(data.totalCount)
      setHasSearchedSocios(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao pesquisar sócios"
      toast.error(message)
    } finally {
      setIsSocioSearching(false)
      socioInFlightRef.current = false
    }
  }, [socioFilters, service])

  const clearSocioFilters = useCallback(() => {
    setSocioFilters(EMPTY_SOCIO_FILTERS)
  }, [])

  return (
    <BackofficeLeadExtractionContext.Provider
      value={{
        activeTab,
        setActiveTab,
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
        socioFilters,
        setSocioFilters,
        socioResults,
        socioTotalCount,
        isSocioSearching,
        hasSearchedSocios,
        handleSocioSearch,
        clearSocioFilters,
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
