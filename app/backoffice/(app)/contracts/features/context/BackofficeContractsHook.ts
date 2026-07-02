import { useCallback, useState } from "react"
import type { BackofficeContractsState } from "./BackofficeContractsTypes"
import type { IBackofficeContractsService } from "../services/IBackofficeContractsService"

const initialState: BackofficeContractsState = {
  items: [],
  clientOptions: [],
  isLoading: true,
  isSaving: false,
  error: null,
}

export function useBackofficeContractsHook(service: IBackofficeContractsService) {
  const [state, setState] = useState<BackofficeContractsState>(initialState)

  const setLoading = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isLoading: value }))
  }, [])

  const setSaving = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSaving: value }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setItems = useCallback((items: BackofficeContractsState["items"]) => {
    setState((prev) => ({ ...prev, items }))
  }, [])

  const setClientOptions = useCallback((clientOptions: BackofficeContractsState["clientOptions"]) => {
    setState((prev) => ({ ...prev, clientOptions }))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [items, clientOptions] = await Promise.all([
        service.list(),
        service.listClientOptions(),
      ])
      setItems(items)
      setClientOptions(clientOptions)
    } catch {
      setError("Erro ao carregar contratos")
    } finally {
      setLoading(false)
    }
  }, [service, setClientOptions, setError, setItems, setLoading])

  return {
    state,
    setSaving,
    setError,
    refresh,
  }
}
