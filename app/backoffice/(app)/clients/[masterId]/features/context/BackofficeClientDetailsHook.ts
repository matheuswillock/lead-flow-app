"use client"

import { useMemo } from "react"
import type { IBackofficeClientDetailsService } from "../services/IBackofficeClientDetailsService"

interface UseBackofficeClientDetailsHookParams {
  masterId: string
  service: IBackofficeClientDetailsService
}

export function useBackofficeClientDetailsHook({
  masterId,
  service,
}: UseBackofficeClientDetailsHookParams) {
  return useMemo(
    () => ({
      masterId,
      service,
    }),
    [masterId, service]
  )
}
