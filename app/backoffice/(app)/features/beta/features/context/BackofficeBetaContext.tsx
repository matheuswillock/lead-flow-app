"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { IBackofficeBetaService } from "../services/IBackofficeBetaService"
import type {
  BetaClientItem,
  BetaClientSearchResult,
  BetaFeatureItem,
  BetaGrantItem,
  BetaGrantTeamItem,
  BetaTeamScope,
} from "./BackofficeBetaTypes"
import { toast } from "sonner"

type AddDialogStep = "search" | "teams"

interface BetaContextValue {
  features: BetaFeatureItem[]
  isLoading: boolean
  reload: () => void

  addDialogOpen: boolean
  addDialogFeature: BetaFeatureItem | null
  addDialogStep: AddDialogStep
  editingGrant: BetaGrantItem | null
  selectedMaster: BetaClientItem | null
  masterTeams: BetaGrantTeamItem[]
  teamScope: BetaTeamScope
  selectedTeamIds: string[]
  isLoadingTeams: boolean
  clientQuery: string
  clientPage: number
  clientResults: BetaClientSearchResult | null
  isSearching: boolean
  isAdding: boolean
  openAddDialog: (feature: BetaFeatureItem) => void
  openEditScopeDialog: (feature: BetaFeatureItem, grant: BetaGrantItem) => void
  closeAddDialog: () => void
  selectMaster: (client: BetaClientItem) => Promise<void>
  backToMasterSearch: () => void
  setClientQuery: (q: string) => void
  setClientPage: (page: number) => void
  setTeamScope: (scope: BetaTeamScope) => void
  toggleTeamSelection: (teamId: string) => void
  confirmBetaGrant: () => Promise<void>

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
  const [addDialogStep, setAddDialogStep] = useState<AddDialogStep>("search")
  const [editingGrant, setEditingGrant] = useState<BetaGrantItem | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<BetaClientItem | null>(null)
  const [masterTeams, setMasterTeams] = useState<BetaGrantTeamItem[]>([])
  const [teamScope, setTeamScopeState] = useState<BetaTeamScope>("ALL_TEAMS")
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [clientQuery, setClientQueryState] = useState("")
  const [clientPage, setClientPage] = useState(1)
  const [clientResults, setClientResults] = useState<BetaClientSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({})

  const inFlight = useRef(false)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetDialogState = useCallback(() => {
    setAddDialogStep("search")
    setEditingGrant(null)
    setSelectedMaster(null)
    setMasterTeams([])
    setTeamScopeState("ALL_TEAMS")
    setSelectedTeamIds([])
    setClientQueryState("")
    setClientPage(1)
    setClientResults(null)
  }, [])

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
        const result = await betaService.searchMasters(query, page)
        setClientResults(result)
      } catch (err) {
        console.error("[BackofficeBetaContext][search]", err)
        toast.error("Erro ao buscar masters")
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

  const loadMasterTeams = useCallback(
    async (masterId: string) => {
      setIsLoadingTeams(true)
      try {
        const teams = await betaService.getMasterTeams(masterId)
        setMasterTeams(teams)
        return teams
      } catch (err) {
        console.error("[BackofficeBetaContext][teams]", err)
        toast.error("Erro ao carregar times do master")
        return []
      } finally {
        setIsLoadingTeams(false)
      }
    },
    [betaService]
  )

  const openAddDialog = useCallback(
    (feature: BetaFeatureItem) => {
      resetDialogState()
      setAddDialogFeature(feature)
      setAddDialogOpen(true)
      runSearch("", 1)
    },
    [resetDialogState, runSearch]
  )

  const openEditScopeDialog = useCallback(
    async (feature: BetaFeatureItem, grant: BetaGrantItem) => {
      resetDialogState()
      setAddDialogFeature(feature)
      setEditingGrant(grant)
      setAddDialogStep("teams")
      setAddDialogOpen(true)
      setSelectedMaster({
        id: grant.profile.id,
        fullName: grant.profile.fullName ?? grant.profile.email ?? "Master",
        email: grant.profile.email ?? "",
        profileIconUrl: null,
      })
      setTeamScopeState(grant.betaTeamScope)
      setSelectedTeamIds(grant.teams.map((team) => team.id))
      await loadMasterTeams(grant.profile.id)
    },
    [loadMasterTeams, resetDialogState]
  )

  const closeAddDialog = useCallback(() => {
    if (!isAdding) {
      setAddDialogOpen(false)
      resetDialogState()
    }
  }, [isAdding, resetDialogState])

  const selectMaster = useCallback(
    async (client: BetaClientItem) => {
      setSelectedMaster(client)
      setAddDialogStep("teams")
      setTeamScopeState("ALL_TEAMS")
      setSelectedTeamIds([])
      await loadMasterTeams(client.id)
    },
    [loadMasterTeams]
  )

  const backToMasterSearch = useCallback(() => {
    if (editingGrant) return
    setAddDialogStep("search")
    setSelectedMaster(null)
    setMasterTeams([])
    setTeamScopeState("ALL_TEAMS")
    setSelectedTeamIds([])
  }, [editingGrant])

  const setTeamScope = useCallback((scope: BetaTeamScope) => {
    setTeamScopeState(scope)
    if (scope === "ALL_TEAMS") {
      setSelectedTeamIds([])
    }
  }, [])

  const toggleTeamSelection = useCallback((teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    )
  }, [])

  const upsertGrantInState = useCallback((featureId: string, grant: BetaGrantItem) => {
    setFeatures((prev) =>
      prev.map((feature) =>
        feature.id === featureId
          ? {
              ...feature,
              grants: [...feature.grants.filter((g) => g.profileId !== grant.profileId), grant],
            }
          : feature
      )
    )
  }, [])

  const confirmBetaGrant = useCallback(async () => {
    if (!addDialogFeature || !selectedMaster || isAdding) return

    if (teamScope === "SPECIFIC_TEAMS" && selectedTeamIds.length === 0) {
      toast.error("Selecione ao menos um time")
      return
    }

    setIsAdding(true)
    try {
      const payload = {
        profileId: selectedMaster.id,
        betaTeamScope: teamScope,
        teamIds: teamScope === "SPECIFIC_TEAMS" ? selectedTeamIds : undefined,
      }

      const rawGrant = editingGrant
        ? await betaService.updateBetaUser(addDialogFeature.id, payload)
        : await betaService.addBetaUser(addDialogFeature.id, payload)

      const grantWithProfile: BetaGrantItem = {
        id: rawGrant.id,
        profileId: rawGrant.profileId,
        isActive: rawGrant.isActive,
        betaTeamScope: rawGrant.betaTeamScope,
        teams: rawGrant.teams,
        profile: {
          id: selectedMaster.id,
          fullName: selectedMaster.fullName,
          email: selectedMaster.email,
        },
      }

      upsertGrantInState(addDialogFeature.id, grantWithProfile)

      toast.success(
        editingGrant
          ? `Escopo beta atualizado para "${selectedMaster.fullName}"`
          : `${selectedMaster.fullName} adicionado ao grupo beta de "${addDialogFeature.name}"`
      )

      setAddDialogOpen(false)
      resetDialogState()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar grupo beta"
      toast.error(message)
    } finally {
      setIsAdding(false)
    }
  }, [
    addDialogFeature,
    betaService,
    editingGrant,
    isAdding,
    resetDialogState,
    selectedMaster,
    selectedTeamIds,
    teamScope,
    upsertGrantInState,
  ])

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
        toast.success("Master removido do grupo beta")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao remover do grupo beta"
        toast.error(message)
      } finally {
        setIsRemoving((prev) => ({ ...prev, [key]: false }))
      }
    },
    [betaService, isRemoving]
  )

  return (
    <BackofficeBetaContext.Provider
      value={{
        features,
        isLoading,
        reload: load,
        addDialogOpen,
        addDialogFeature,
        addDialogStep,
        editingGrant,
        selectedMaster,
        masterTeams,
        teamScope,
        selectedTeamIds,
        isLoadingTeams,
        clientQuery,
        clientPage,
        clientResults,
        isSearching,
        isAdding,
        openAddDialog,
        openEditScopeDialog,
        closeAddDialog,
        selectMaster,
        backToMasterSearch,
        setClientQuery,
        setClientPage: handleSetClientPage,
        setTeamScope,
        toggleTeamSelection,
        confirmBetaGrant,
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
