"use client"

import Image from "next/image"
import { div as MotionDiv } from "framer-motion/client"
import { integrationsData } from "@/lib/landing/integrations-data"
import { cn } from "@/lib/utils"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

export function IntegrationsSection() {
  const headingMotion = useLandingReveal({ distance: 20, duration: 0.6 })

  return (
    <section id="integ" className="bg-landing-warm py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...headingMotion} className="mx-auto mb-12 max-w-3xl text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.05em] text-primary">
            Integrações
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] text-landing-ink md:text-5xl">
            Conecta com o que você já usa
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-8 text-landing-body">
            Transforme visitantes em oportunidades automaticamente. Os leads entram pelo site ou ADS
            e o atendimento começa sem intervenção manual.
          </p>
        </MotionDiv>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {integrationsData.map((integration) => (
            <article key={integration.title} className="landing-integration-card">
              <div className={cn("landing-integration-icon", `landing-integration-icon--${integration.tone}`)}>
                {"iconSrc" in integration ? (
                  <Image
                    src={integration.iconSrc}
                    alt={integration.iconAlt}
                    width={40}
                    height={40}
                    className="size-9"
                  />
                ) : "svgPath" in integration ? (
                  <svg viewBox="0 0 24 24" className="size-9" aria-hidden>
                    <path fill={integration.svgFill} d={integration.svgPath} />
                  </svg>
                ) : (
                  <integration.icon className="size-7" aria-hidden />
                )}
              </div>
              <h3 className="font-display text-lg font-bold tracking-[-0.02em] text-landing-ink">
                {integration.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-landing-body">{integration.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
