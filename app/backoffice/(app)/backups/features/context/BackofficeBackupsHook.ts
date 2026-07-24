"use client"

import { useMemo } from "react"
import type { IBackofficeBackupsService } from "../services/IBackofficeBackupsService"

interface UseBackofficeBackupsHookParams {
  service: IBackofficeBackupsService
}

export function useBackofficeBackupsHook({ service }: UseBackofficeBackupsHookParams) {
  return useMemo(() => ({ service }), [service])
}
