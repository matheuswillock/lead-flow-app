"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_CLIENT_BASE } from "@/lib/route-map"

export function AccountAccessRecoveryButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function startRecovery() {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/billing/card-reauthorization`, { method: "POST" })
      const output = await response.json() as { isValid: boolean; result: { token?: string } | null; errorMessages: string[] }
      if (!response.ok || !output.isValid || !output.result?.token) {
        setErrorMessage(output.errorMessages[0] ?? "Não foi possível iniciar a regularização agora.")
        return
      }
      window.location.assign(`/reautorizar-pagamento/${encodeURIComponent(output.result.token)}`)
    } catch {
      setErrorMessage("Não foi possível iniciar a regularização agora.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <Button type="button" className="h-11 w-full" disabled={isLoading} onClick={startRecovery}>
        <CreditCard data-icon="inline-start" />
        {isLoading ? "Preparando checkout…" : "Regularizar assinatura"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
