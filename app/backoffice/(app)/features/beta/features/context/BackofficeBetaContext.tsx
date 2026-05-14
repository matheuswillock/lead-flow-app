"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { IBackofficeBetaService } from "../services/IBackofficeBetaService"
import type { BetaClientItem, BetaClientSearchResult, BetaFeatureItem, BetaGrantItem } from "./BackofficeBetaTypes"
import { toast } from "sonner"

interface BetaContextValue {
  features: BetaFeatureItem[]
  isLoading: boolean
  reload: () => void

  // Add user dialog
  addDialogOpen: boolean
  addDialogFeature: BetaFeatureItem | null
  clientQuery: string
  clientPage: number
  clientResults: BetaClientSearchResult | null
  isSearching: boolean
  isAdding: boolean
  openAddDialog: (feature: BetaFeatureItem) => void
  closeAddDialog: () => void
  setClientQuery: (q: string) => void
  setClientPage: (page: number) => void
  addBetaUser: (client: BetaClientItem) => Promise<void>

  // Remove
  isRemoving: Record<string, boolean>
  removeBetaUser: (featureId: string, profileId: string) => Promise<void>
}

const BackofficeBetaContext = createContext<BetaContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  betaService: IBackofficeBetaService
}

export function BackofficeBetaProvider({ children, betaService }: Props) {
  const [features, setFeatures] = useState<BetaFeatureItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogFeature, setAddDialogFeature] = useState<BetaFeatureItem | null>(null)
  const [clientQuery, setClientQueryState] = useState("")
  const [clientPage, setClientPage] = useState(1)
  const [clientResults, setClientResults] = useState<BetaClientSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({})

  const inFlight = useRef(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    try {
      const items = await betaService.listBetaFeatures()
      setFeatures(items)
    } catch (err) {
      console.error("[BackofficeBetaContext]", err)
      toast.error("Erro ao carregar grupo beta")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [betaService])

  useEffect(() => {
    load()
  }, [load])

  const runSearch = useCallback(
    async (query: string, page: number) => {
      setIsSearching(true)
      try {
        const result = await betaService.searchClients(query, page)
        setClientResults(result)
      } catch (err) {
        console.error("[BackofficeBetaContext][search]", err)
        toast.error("Erro ao buscar clientes")
      } finally {
        setIsSearching(false)
      }
    },
    [betaService]
  )

  const setClientQuery = useCallback(
    (q: string) => {
      setClientQueryState(q)
      setClientPage(1)
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
      searchDebounce.current = setTimeout(() => {
        runSearch(q, 1)
      }, 350)
    },
    [runSearch]
  )

  const handleSetClientPage = useCallback(
    (page: number) => {
      setClientPage(page)
      runSearch(clientQuery, page)
    },
    [clientQuery, runSearch]
  )

  const openAddDialog = useCallback(
    (feature: BetaFeatureItem) => {
      setAddDialogFeature(feature)
      setClientQueryState("")
      setClientPage(1)
      setClientResults(null)
      setAddDialogOpen(true)
      runSearch("", 1)
    },
    [runSearch]
  )

  const closeAddDialog = useCallback(() => {
    if (!isAdding) setAddDialogOpen(false)
  }, [isAdding])

  const addBetaUser = useCallback(
    async (client: BetaClientItem) => {
      if (!addDialogFeature || isAdding) return
      setIsAdding(true)
      try {
        const rawGrant = await betaService.addBetaUser(addDialogFeature.id, client.id)
        const grantWithProfile: BetaGrantItem = {
          id: rawGrant.id,
          profileId: rawGrant.profileId,
          isActive: rawGrant.isActive,
          profile: {
            id: client.id,
            fullName: client.fullName,
            email: client.email,
          },
        }
        setFeatures((prev) =>
          prev.map((f) =>
            f.id === addDialogFeature.id
              ? { ...f, grants: [...f.grants.filter((g) => g.profileId !== client.id), grantWithProfile] }
              : f
          )
        )
        toast.success(`${client.fullName} adicionado ao grupo beta de "${addDialogFeature.name}"`)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao adicionar ao grupo beta"
        toast.error(message)
      } finally {
        setIsAdding(false)
      }
    },
    [addDialogFeature, isAdding, betaService]
  )

  const removeBetaUser = useCallback(
    async (featureId: string, profileId: string) => {
      const key = `${featureId}:${profileId}`
      if (isRemoving[key]) return
      setIsRemoving((prev) => ({ ...prev, [key]: true }))
      try {
        await betaService.removeBetaUser(featureId, profileId)
        setFeatures((prev) =>
          prev.map((f) =>
            f.id === featureId
              ? { ...f, grants: f.grants.filter((g) => g.profileId !== profileId) }
              : f
          )
        )
        toast.success("Usuário removido do grupo beta")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao remover do grupo beta"
        toast.error(message)
      } finally {
        setIsRemoving((prev) => ({ ...prev, [key]: false }))
      }
    },
    [isRemoving, betaService]
  )

  return (
    <BackofficeBetaContext.Provider
      value={{
        features,
        isLoading,
        reload: load,
        addDialogOpen,
        addDialogFeature,
        clientQuery,
        clientPage,
        clientResults,
        isSearching,
        isAdding,
        openAddDialog,
        closeAddDialog,
        setClientQuery,
        setClientPage: handleSetClientPage,
        addBetaUser,
        isRemoving,
        removeBetaUser,
      }}
    >
      {children}
    </BackofficeBetaContext.Provider>
  )
}

export function useBackofficeBeta(): BetaContextValue {
  const ctx = useContext(BackofficeBetaContext)
  if (!ctx) throw new Error("useBackofficeBeta must be used within BackofficeBetaProvider")
  return ctx
}
