"use client"

import { useEffect, useRef, useState } from "react"
import { useInView, useReducedMotion } from "framer-motion"
import type { LandingStat } from "@/lib/landing/stats-data"

type StatsBandProps = {
  stats: LandingStat[]
}

function formatCompact(value: number) {
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)
    return `${formatted.replace(".", ",").replace(",0", "")}M`
  }

  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(value >= 10_000 ? 0 : 1)
    return `${formatted.replace(".", ",").replace(",0", "")} mil`
  }

  return Math.round(value).toLocaleString("pt-BR")
}

function formatStat(value: number, stat: LandingStat) {
  if (stat.format === "compact") {
    return formatCompact(value)
  }

  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: stat.decimals ?? 0,
    maximumFractionDigits: stat.decimals ?? 0,
  })
}

export function StatsBand({ stats }: StatsBandProps) {
  const ref = useRef<HTMLElement | null>(null)
  const isInView = useInView(ref, { once: true, amount: 0.4 })
  const prefersReducedMotion = useReducedMotion()
  const [progress, setProgress] = useState(prefersReducedMotion ? 1 : 0)

  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      if (prefersReducedMotion) setProgress(1)
      return
    }

    let frame = 0
    const start = performance.now()
    const duration = 1400

    const tick = (now: number) => {
      const raw = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - raw, 3)
      setProgress(eased)
      if (raw < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isInView, prefersReducedMotion])

  return (
    <section ref={ref} className="landing-stats-band py-16 md:py-20" aria-label="Resultados do Corretor Studio">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 text-center sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
        {stats.map((stat) => {
          const currentValue = stat.value * progress
          return (
            <div key={stat.label}>
              <p className="font-display text-4xl font-extrabold leading-none tracking-[-0.03em] text-landing-stat md:text-5xl">
                {stat.prefix}
                {formatStat(currentValue, stat)}
                {stat.suffix}
              </p>
              <p className="mt-3 text-sm font-medium text-landing-stat-muted">{stat.label}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
