import { useCallback, useState } from "react"
import type { BackofficeFormTemplatesState } from "./BackofficeFormTemplatesTypes"
import type { IBackofficeFormTemplatesService } from "../services/IBackofficeFormTemplatesService"

const initialState: BackofficeFormTemplatesState = {
  items: [],
  isLoading: true,
  isSaving: false,
  error: null,
}

export function useBackofficeFormTemplatesHook(service: IBackofficeFormTemplatesService) {
  const [state, setState] = useState<BackofficeFormTemplatesState>(initialState)

  const setLoading = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isLoading: value }))
  }, [])

  const setSaving = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSaving: value }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }))
  }, [])

  const setItems = useCallback((items: BackofficeFormTemplatesState["items"]) => {
    setState((prev) => ({ ...prev, items }))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await service.list(true))
    } catch {
      setError("Erro ao carregar templates de formulário")
    } finally {
      setLoading(false)
    }
  }, [service, setError, setItems, setLoading])

  return {
    state,
    setSaving,
    setError,
    refresh,
  }
}
