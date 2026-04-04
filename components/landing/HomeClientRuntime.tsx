"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function HomeClientRuntime() {
  const router = useRouter()
  const [showCookieConsent, setShowCookieConsent] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent")
    setShowCookieConsent(!consent)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const hash = window.location.hash
    if (!hash) return

    const hashParams = new URLSearchParams(hash.substring(1))
    const type = hashParams.get("type")
    const accessToken = hashParams.get("access_token")

    if ((type === "recovery" || type === "invite") && accessToken) {
      console.info("Token detectado, redirecionando para /set-password")
      router.push(`/set-password${hash}`)
    }
  }, [router])

  if (!showCookieConsent) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] rounded-2xl border p-4 shadow-2xl backdrop-blur-xl"
      style={{
        borderColor: "rgba(255, 255, 255, 0.12)",
        background:
          "linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04))",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.06)",
      }}
      data-nosnippet
    >
      <p className="text-sm text-muted-foreground">
        Usamos cookies para melhorar sua experiência e analisar o uso da plataforma.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            localStorage.setItem("cookieConsent", "accepted")
            setShowCookieConsent(false)
          }}
          className="cursor-pointer inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
          style={{
            background: "var(--primary)",
            color: "var(--primary-foreground)",
          }}
        >
          Aceitar
        </button>
        <button
          onClick={() => {
            localStorage.setItem("cookieConsent", "declined")
            setShowCookieConsent(false)
          }}
          className="cursor-pointer inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold text-muted-foreground"
          style={{
            borderColor: "rgba(255, 255, 255, 0.16)",
          }}
        >
          Recusar
        </button>
        <Link className="text-sm underline underline-offset-4" href="/cookies">
          Saiba mais
        </Link>
      </div>
    </div>
  )
}
