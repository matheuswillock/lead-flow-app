"use client"

import { useMemo } from "react"
import type { IBackofficeApprovalsService } from "../services/IBackofficeApprovalsService"

interface UseBackofficeApprovalsHookParams {
  service: IBackofficeApprovalsService
}

export function useBackofficeApprovalsHook({ service }: UseBackofficeApprovalsHookParams) {
  return useMemo(() => ({ service }), [service])
}
