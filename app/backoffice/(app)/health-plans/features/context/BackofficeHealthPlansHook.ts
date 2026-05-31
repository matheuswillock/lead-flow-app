import { useCallback, useState } from "react"
import type { BackofficeHealthPlansState } from "./BackofficeHealthPlansTypes"
import type { IBackofficeHealthPlansService } from "../services/IBackofficeHealthPlansService"

const initialState: BackofficeHealthPlansState = {
  items: [],
  isLoading: true,
  isSaving: false,
  error: null,
}

export function useBackofficeHealthPlansHook(service: IBackofficeHealthPlansService) {
  const [state, setState] = useState<BackofficeHealthPlansState>(initialState)

  const setLoading = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isLoading: value }))
  }, [])

  const setSaving = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSaving: value }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setItems = useCallback((items: BackofficeHealthPlansState["items"]) => {
    setState((prev) => ({ ...prev, items }))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await service.list(true))
    } catch {
      setError("Erro ao carregar operadoras")
    } finally {
      setLoading(false)
    }
  }, [service, setError, setItems, setLoading])

  return {
    state,
    setLoading,
    setSaving,
    setError,
    setItems,
    refresh,
  }
}
