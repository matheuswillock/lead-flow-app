"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Cookie } from "lucide-react"

export function HomeClientRuntime() {
  const router = useRouter()
  const [showCookieConsent, setShowCookieConsent] = useState(false)

  useEffect(() => {
    try {
      setShowCookieConsent(!window.localStorage.getItem("cookieConsent"))
    } catch {
      // Offer consent when the browser disables storage and keep it dismissible in memory.
      setShowCookieConsent(true)
    }
  }, [])

  const dismissCookieConsent = (choice: "accepted" | "essential") => {
    try {
      window.localStorage.setItem("cookieConsent", choice)
    } catch {
      // Keep the choice usable for this visit when browser storage is disabled.
    }
    setShowCookieConsent(false)
  }

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
      role="region"
      aria-label="Aviso de cookies"
      className="landing-page fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-4xl flex-col gap-4 rounded-3xl border border-landing-line bg-card p-5 shadow-2xl sm:p-6 md:flex-row md:items-center md:gap-6"
      data-nosnippet
    >
      <div className="flex flex-1 items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Cookie className="size-6" aria-hidden />
        </span>
        <div>
          <p className="font-display text-base font-bold text-landing-ink">Usamos cookies</p>
          <p className="mt-1 text-sm leading-6 text-landing-body">
            Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos
            para melhorar sua experiência. Veja nossa{" "}
            <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/cookies">
              Política de Cookies
            </Link>{" "}
            e a{" "}
            <Link
              className="font-semibold text-primary underline-offset-4 hover:underline"
              href="/privacy-policy"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => dismissCookieConsent("essential")}
          className="landing-secondary-cta inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Só essenciais
        </button>
        <button
          type="button"
          onClick={() => dismissCookieConsent("accepted")}
          className="landing-primary-cta inline-flex min-h-11 cursor-pointer items-center justify-center rounded-2xl px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Aceitar todos
        </button>
      </div>
    </div>
  )
}
