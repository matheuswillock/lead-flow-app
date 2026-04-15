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
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] rounded-2xl border border-border/20 p-4 shadow-2xl backdrop-blur-xl bg-background/80" data-nosnippet>
      <p className="text-sm text-muted-foreground">
        Usamos cookies para melhorar sua experiência e analisar o uso da plataforma.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            localStorage.setItem("cookieConsent", "accepted")
            setShowCookieConsent(false)
          }}
          className="cursor-pointer inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground"
        >
          Aceitar
        </button>
        <button
          onClick={() => {
            localStorage.setItem("cookieConsent", "declined")
            setShowCookieConsent(false)
          }}
          className="cursor-pointer inline-flex items-center justify-center rounded-xl border border-border/20 px-3 py-2 text-sm font-semibold text-muted-foreground"
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
