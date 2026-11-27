"use client"

import { useState } from "react"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface WhatsAppVerificationPanelProps {
  supabaseId: string
  whatsappPhone: string | null
  verifiedAt: string | null
  onVerified: () => void
}

export function WhatsAppVerificationPanel({
  supabaseId,
  whatsappPhone,
  verifiedAt,
  onVerified,
}: WhatsAppVerificationPanelProps) {
  const [phone, setPhone] = useState(whatsappPhone ?? "")
  const [code, setCode] = useState("")
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCurrentPhoneVerified = Boolean(verifiedAt && phone === whatsappPhone)

  async function requestCode() {
    setIsRequesting(true)
    setError(null)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/profiles/${supabaseId}/whatsapp-verification/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const result = await response.json() as { success?: boolean; challengeId?: string; error?: string }
      if (!response.ok || !result.success || !result.challengeId) {
        setError(result.error || "Não foi possível enviar o código. Confira o número e tente novamente.")
        return
      }
      setChallengeId(result.challengeId)
      setCode("")
    } catch {
      setError("Não foi possível enviar o código. Verifique sua conexão e tente novamente.")
    } finally {
      setIsRequesting(false)
    }
  }

  async function verifyCode() {
    if (!challengeId) return
    setIsVerifying(true)
    setError(null)
    try {
      const response = await fetch(`${API_CLIENT_BASE}/profiles/${supabaseId}/whatsapp-verification/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      })
      const result = await response.json() as { success?: boolean; error?: string }
      if (!response.ok || !result.success) {
        setError(result.error || "Código inválido ou expirado. Confira e tente novamente.")
        return
      }
      setChallengeId(null)
      onVerified()
    } catch {
      setError("Não foi possível confirmar o código. Verifique sua conexão e tente novamente.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <section aria-labelledby="whatsapp-verification-title" className="space-y-4 rounded-lg border border-border/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="whatsapp-verification-title" className="text-base font-medium">WhatsApp para notificações</h2>
          <p className="mt-1 text-sm text-muted-foreground">Este número é independente do telefone geral do seu perfil.</p>
        </div>
        <span className="text-sm font-medium" role="status">
          {verifiedAt ? "WhatsApp verificado" : "WhatsApp não verificado"}
        </span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-phone">Número de WhatsApp</Label>
        <Input
          id="whatsapp-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value)
            setChallengeId(null)
            setCode("")
          }}
          aria-describedby="whatsapp-phone-hint"
          disabled={isRequesting || isVerifying}
        />
        <p id="whatsapp-phone-hint" className="text-xs text-muted-foreground">Informe o número com código do país, por exemplo +5511999999999.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void requestCode()} disabled={!phone.trim() || isRequesting || isVerifying || isCurrentPhoneVerified}>{isRequesting ? "Enviando código..." : "Enviar código"}</Button>
      </div>
      {challengeId && (
        <div className="space-y-3 border-t border-border/60 pt-4">
          <div className="space-y-2">
            <Label htmlFor="whatsapp-code">Código de verificação</Label>
            <Input id="whatsapp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} disabled={isVerifying} />
          </div>
          <Button type="button" onClick={() => void verifyCode()} disabled={code.length !== 6 || isVerifying}>{isVerifying ? "Confirmando..." : "Confirmar código"}</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
