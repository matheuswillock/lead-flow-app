"use client"

import { useMemo } from "react"
import type { IBackofficeAnathemasService } from "../services/IBackofficeAnathemasService"

interface UseBackofficeAnathemasHookParams {
  service: IBackofficeAnathemasService
}

export function useBackofficeAnathemasHook({ service }: UseBackofficeAnathemasHookParams) {
  return useMemo(() => ({ service }), [service])
}
