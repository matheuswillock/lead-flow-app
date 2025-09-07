"use client"

import dynamic from "next/dynamic"

const LandingSection = dynamic(() => import("@/components/landing/LandingSection"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-2xl p-10 text-center text-muted-foreground">Carregando…</div>
  ),
})

export default function Home() {
  return <LandingSection />
}
