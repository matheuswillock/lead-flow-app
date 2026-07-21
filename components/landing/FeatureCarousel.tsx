"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"
import { div as MotionDiv } from "framer-motion/client"
import { useReducedMotion } from "framer-motion"
import { DemoRequestDialogButton } from "./DemoRequestDialog"
import { featurePanelsData } from "@/lib/landing/feature-panels-data"
import { cn } from "@/lib/utils"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

const AUTOPLAY_MS = 15000

export function FeatureCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [crmView, setCrmView] = useState<"pipeline" | "kanban">("pipeline")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prefersReducedMotion = useReducedMotion()
  const sectionMotion = useLandingReveal({ distance: 20, duration: 0.6 })

  const activePanel = featurePanelsData[activeIndex]

  const goTo = useCallback((nextIndex: number) => {
    setActiveIndex((nextIndex + featurePanelsData.length) % featurePanelsData.length)
  }, [])

  const resetAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (prefersReducedMotion) return
    timerRef.current = setInterval(() => {
      setActiveIndex((current) => (current + 1) % featurePanelsData.length)
    }, AUTOPLAY_MS)
  }, [prefersReducedMotion])

  useEffect(() => {
    resetAutoplay()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [resetAutoplay])

  const crmImage = crmView === "pipeline" ? "/images/landing/crm.webp" : "/images/landing/crm-kanban.webp"
  const crmAlt =
    crmView === "pipeline"
      ? "Tela do CRM com pipeline de leads em tabela"
      : "Tela do CRM com pipeline de leads em Kanban"

  const trackStyle = useMemo(
    () => ({ transform: `translateX(-${activeIndex * 100}%)` }),
    [activeIndex],
  )

  return (
    <section id="crm" className="py-20 md:py-28">
      <MotionDiv {...sectionMotion} className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="landing-feature-carousel">
          <div className="landing-feature-viewport" role="region" aria-live="polite" aria-label="Recursos da plataforma">
            <div className="landing-feature-track" style={trackStyle}>
              {featurePanelsData.map((panel) => {
                const isCrm = panel.hasCrmToggle
                const imageSrc = isCrm ? crmImage : panel.image
                const imageAlt = isCrm ? crmAlt : panel.imageAlt
                const isDashboardLcpImage = imageSrc === "/images/landing/dashboard-dark.webp"

                return (
                  <article key={panel.id} className={cn("landing-feature-panel", panel.colorClass)}>
                    <div aria-hidden className="landing-feature-glow" />
                    <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
                      <div>
                        <p className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.05em] text-landing-panel-muted">
                          {panel.eyebrow}
                        </p>
                        <h2 className="max-w-xl text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-4xl">
                          {panel.title}
                        </h2>
                        <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-landing-panel-body md:text-lg">
                          {panel.description}
                        </p>
                        <ul className="mt-6 flex flex-col gap-3">
                          {panel.bullets.map((bullet) => (
                            <li key={bullet} className="flex items-start gap-3 text-sm leading-6 md:text-base">
                              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-landing-panel-check">
                                <Check className="size-3.5" aria-hidden />
                              </span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                        <DemoRequestDialogButton
                          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-card px-5 py-3 font-semibold text-landing-ink transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {panel.cta}
                        </DemoRequestDialogButton>
                      </div>

                      <div>
                        <div className="landing-shot">
                          <div className="landing-window-bar">
                            <span />
                            <span />
                            <span />
                            <p>{isCrm ? (crmView === "pipeline" ? "Pipeline · CRM" : "Kanban · CRM") : panel.windowTitle}</p>
                          </div>
                          <Image
                            src={imageSrc}
                            alt={imageAlt}
                            width={1322}
                            height={802}
                            className="h-auto w-full"
                            sizes="(max-width: 1024px) 88vw, 600px"
                            loading={isDashboardLcpImage ? "eager" : "lazy"}
                          />
                        </div>
                        {isCrm && (
                          <div className="mt-5 inline-flex rounded-full border border-landing-panel-border bg-landing-panel-control p-1">
                            {[
                              { value: "pipeline", label: "Pipeline" },
                              { value: "kanban", label: "Kanban" },
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={cn(
                                  "min-h-11 rounded-full px-5 text-sm font-bold text-landing-panel-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  crmView === option.value && "bg-card text-landing-ink",
                                )}
                                aria-pressed={crmView === option.value}
                                onClick={() => setCrmView(option.value as "pipeline" | "kanban")}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Ver recurso anterior"
            className={cn("landing-feature-arrow landing-feature-arrow--prev", activePanel.accentClass)}
            onClick={() => {
              goTo(activeIndex - 1)
              resetAutoplay()
            }}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Ver próximo recurso"
            className={cn("landing-feature-arrow landing-feature-arrow--next", activePanel.accentClass)}
            onClick={() => {
              goTo(activeIndex + 1)
              resetAutoplay()
            }}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {featurePanelsData.map((panel, index) => {
              const isActive = index === activeIndex

              return (
                <button
                  key={panel.id}
                  type="button"
                  className={cn(
                    "landing-feature-dot",
                    isActive && cn("landing-feature-dot--active", panel.accentClass),
                  )}
                  aria-label={`Ver recurso ${panel.navLabel}`}
                  aria-current={isActive}
                  onClick={() => {
                    goTo(index)
                    resetAutoplay()
                  }}
                >
                  {isActive && <span className="landing-feature-dot-label">{panel.navLabel}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </MotionDiv>
    </section>
  )
}
