"use client"

import { useMemo } from "react"
import type { IPaymentProviderPreviewService } from "../services/IPaymentProviderPreviewService"
import type { PaymentProviderPreviewContextValue } from "./PaymentProviderPreviewTypes"

export function usePaymentProviderPreviewHook(
  service: IPaymentProviderPreviewService,
): PaymentProviderPreviewContextValue {
  return useMemo(() => service.getState(), [service])
}
