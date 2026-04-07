"use client"

import { useMemo } from "react"
import type { IBackofficeClientInvoiceDetailsService } from "../services/IBackofficeClientInvoiceDetailsService"

interface UseBackofficeClientInvoiceDetailsHookParams {
  masterId: string
  invoiceId: string
  service: IBackofficeClientInvoiceDetailsService
}

export function useBackofficeClientInvoiceDetailsHook({
  masterId,
  invoiceId,
  service,
}: UseBackofficeClientInvoiceDetailsHookParams) {
  return useMemo(
    () => ({
      masterId,
      invoiceId,
      service,
    }),
    [masterId, invoiceId, service]
  )
}
