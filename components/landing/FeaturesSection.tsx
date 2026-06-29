"use client"

import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight, BarChart3, CalendarDays, Kanban, Mail, Paperclip, Users, Users2 } from "lucide-react"
import { featuresData, FEATURES_SECTION_SUBHEADING } from "@/lib/landing/features-data"
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

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-25 landing-features-orbs"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Tudo que você precisa para{" "}
            <span className="landing-primary-gradient">vender mais</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {FEATURES_SECTION_SUBHEADING}
          </p>
        </MotionDiv>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">

          {/* Row 1: Kanban (large, col-span-2) + Calendar (col-span-1) */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="group relative md:col-span-2 rounded-2xl p-8 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 landing-surface-card"
          >
            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110 bg-primary/15 text-primary"
            >
              <Kanban className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[0].title}</h3>
            <p className="text-muted-foreground mb-5">{features[0].description}</p>
            <ul className="space-y-2.5">
              {features[0].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative rounded-2xl p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 landing-surface-card-compact"
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary"
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[1].title}</h3>
            <p className="text-sm text-muted-foreground">{features[1].description}</p>
          </MotionDiv>

          {/* Row 2: Teams (col-span-1) + Email Campaigns (large, col-span-2) */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="group relative rounded-2xl p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 landing-surface-card-compact"
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary"
            >
              <Users2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{features[2].title}</h3>
            <p className="text-sm text-muted-foreground">{features[2].description}</p>
          </MotionDiv>

          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group relative md:col-span-2 rounded-2xl p-8 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 landing-surface-card"
          >
            {/* Em breve badge */}
            <span className="absolute top-4 right-4 rounded-full px-2.5 py-0.5 text-xs font-bold bg-primary text-primary-foreground">
              Em breve
            </span>

            <div
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl mb-5 transition-transform group-hover:scale-110 bg-primary/15 text-primary"
            >
              <Mail className="h-7 w-7" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">{features[3].title}</h3>
            <p className="text-muted-foreground mb-5">{features[3].description}</p>
            <ul className="space-y-2.5">
              {features[3].benefits?.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </MotionDiv>

          {/* Row 3: Dashboard + Operators + Attachments */}
          {[features[4], features[5], features[6]].map((feature, idx) => (
            <MotionDiv
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.25 + idx * 0.08 }}
              className="group relative rounded-2xl p-6 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/30 landing-surface-card-compact"
            >
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 transition-transform group-hover:scale-110 bg-primary/15 text-primary"
              >
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
