"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, CalendarDays, Kanban, Mail, Paperclip, Users, Users2 } from "lucide-react"
import { featuresData, FEATURES_SECTION_SUBHEADING } from "@/lib/landing/features-data"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"
import type { ElementType } from "react"

type Feature = {
  icon: ElementType
  title: string
  description: string
  badge?: string
  benefits?: string[]
  size: "large" | "small"
}

const FEATURE_ICONS: ElementType[] = [Kanban, CalendarDays, Users2, Mail, BarChart3, Users, Paperclip]

const features: Feature[] = featuresData.map((f, i) => ({
  ...f,
  icon: FEATURE_ICONS[i],
}))

const cardBase =
  "group relative rounded-2xl border border-border bg-card transition-colors hover:border-primary/30"
const cardLarge = `${cardBase} md:col-span-2 p-8`
const cardCompact = `${cardBase} p-6`

export function FeaturesSection() {
  const headingMotion = useLandingReveal({ distance: 20, duration: 0.6 })
  const row1Motion = useLandingReveal({ distance: 20, duration: 0.5 })
  const row1bMotion = useLandingReveal({ distance: 20, duration: 0.5, delay: 0.1 })
  const row2aMotion = useLandingReveal({ distance: 20, duration: 0.5, delay: 0.15 })
  const row2bMotion = useLandingReveal({ distance: 20, duration: 0.5, delay: 0.2 })
  const row3Motions = [
    useLandingReveal({ distance: 20, duration: 0.5, delay: 0.25 }),
    useLandingReveal({ distance: 20, duration: 0.5, delay: 0.33 }),
    useLandingReveal({ distance: 20, duration: 0.5, delay: 0.41 }),
  ]

  return (
    <section id="features" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 landing-features-orbs"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...headingMotion} className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Tudo que você precisa para{" "}
            <span className="text-primary">vender mais</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {FEATURES_SECTION_SUBHEADING}
          </p>
        </MotionDiv>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          <MotionDiv {...row1Motion} className={cardLarge}>
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110 bg-primary/15 text-primary">
              <Kanban className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[0].title}</h3>
            <p className="text-muted-foreground mb-5">{features[0].description}</p>
            <ul className="flex flex-col gap-2.5">
              {features[0].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          <MotionDiv {...row1bMotion} className={cardCompact}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[1].title}</h3>
            <p className="text-sm text-muted-foreground">{features[1].description}</p>
          </MotionDiv>

          <MotionDiv {...row2aMotion} className={cardCompact}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary">
              <Users2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[2].title}</h3>
            <p className="text-sm text-muted-foreground">{features[2].description}</p>
          </MotionDiv>

          <MotionDiv {...row2bMotion} className={cardLarge}>
            <span className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-bold bg-primary text-primary-foreground">
              Em breve
            </span>

            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110 bg-primary/15 text-primary">
              <Mail className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[3].title}</h3>
            <p className="text-muted-foreground mb-5">{features[3].description}</p>
            <ul className="flex flex-col gap-2.5">
              {features[3].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          {[features[4], features[5], features[6]].map((feature, idx) => (
              <MotionDiv key={feature.title} {...row3Motions[idx]} className={cardCompact}>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </MotionDiv>
            ))}
        </div>
      </div>
    </section>
  )
}
