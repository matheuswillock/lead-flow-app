"use client"

import { useEffect, useRef } from "react"
import { createLandingAnalyticsEvent, landingAnalyticsEndpoint } from "@/lib/landing-analytics/client"
import type { LandingPageSnapshot } from "@/lib/landing-pages/types"

type Props = { snapshot: LandingPageSnapshot; children: React.ReactNode }

function sessionId() {
  const key = "landing-analytics:visitor-session"
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const created = `visitor_${crypto.randomUUID().replaceAll("-", "")}`
  window.sessionStorage.setItem(key, created)
  return created
}

export function LandingAnalyticsTracker({ snapshot, children }: Props) {
  const startedAt = useRef(Date.now())
  const sentMilestones = useRef(new Set<number>())

  useEffect(() => {
    const visitorSessionId = sessionId()
    const endpoint = landingAnalyticsEndpoint(snapshot.publicId)
    const context = {
      landingPageId: snapshot.landingPageId,
      publicationId: `${snapshot.landingPageId}:${snapshot.version}`,
      templateSlug: snapshot.templateSlug as "black-and-white" | "alvora",
      visitorSessionId,
      attribution: Object.fromEntries(new URLSearchParams(window.location.search).entries()),
    }
    const send = (eventType: Parameters<typeof createLandingAnalyticsEvent>[1], metadata?: Record<string, unknown>) => {
      const payload = createLandingAnalyticsEvent(context, eventType, metadata)
      void fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => undefined)
    }

    send("landing.page_view", { referrer: document.referrer || undefined })
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable <= 0) return
      const depth = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight) * 100))
      for (const milestone of [25, 50, 75, 100]) {
        if (depth >= milestone && !sentMilestones.current.has(milestone)) {
          sentMilestones.current.add(milestone)
          send("landing.scroll_depth", { depth, milestone })
        }
      }
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a,button") : null
      if (!target) return
      const destination = target instanceof HTMLAnchorElement ? target.href : undefined
      const label = target.textContent?.trim().slice(0, 120)
      send("landing.cta_click", { destination, label, elapsedMs: Date.now() - startedAt.current })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("click", onClick)
    return () => {
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("click", onClick)
    }
  }, [snapshot.landingPageId, snapshot.publicId, snapshot.templateSlug, snapshot.version])

  return children
}
