"use client"

import { useMemo } from "react"
import type { IBackofficeAllUsersService } from "../services/IBackofficeAllUsersService"

interface UseBackofficeAllUsersHookParams {
  service: IBackofficeAllUsersService
}

export function useBackofficeAllUsersHook({ service }: UseBackofficeAllUsersHookParams) {
  return useMemo(() => ({ service }), [service])
}
