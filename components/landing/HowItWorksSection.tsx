"use client"

import { div as MotionDiv } from "framer-motion/client"
import { BarChart3, CalendarDays, Filter, UserPlus, Users2 } from "lucide-react"
import type { ElementType } from "react"
import { howItWorksSteps, HOW_IT_WORKS_SUBHEADING } from "@/lib/landing/how-it-works-data"

const STEP_ICONS: ElementType[] = [UserPlus, Filter, CalendarDays, Users2, BarChart3]

const steps = howItWorksSteps.map((s, i) => ({ ...s, icon: STEP_ICONS[i] }))

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 landing-how-orbs" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Como funciona o{" "}
            <span className="landing-primary-gradient">Corretor Studio</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {HOW_IT_WORKS_SUBHEADING}
          </p>
        </MotionDiv>

        <div className="hidden lg:block relative">
          <div
            className="absolute left-[10%] right-[10%] top-7 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-muted-foreground/45 to-transparent"
            aria-hidden
          />

          <div className="grid grid-cols-5 gap-4">
            {steps.map((step, idx) => (
              <MotionDiv
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="flex flex-col items-center text-center px-2"
              >
                <div className="relative mb-5">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg border border-primary/30 text-primary">
                    <div aria-hidden className="absolute inset-0 rounded-2xl bg-background" />
                    <div aria-hidden className="absolute inset-0 rounded-2xl bg-primary/10" />
                    <step.icon className="relative z-10 h-6 w-6" />
                  </div>
                </div>

                <h3 className="text-base font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </MotionDiv>
            ))}
          </div>
        </div>

        <div className="lg:hidden space-y-8">
          {steps.map((step, idx) => (
            <MotionDiv
              key={step.number}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="flex items-start gap-5"
            >
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg font-extrabold text-sm border border-primary/30 bg-primary/10 text-primary">
                  {step.number}
                </div>
                {idx < steps.length - 1 && (
                  <div className="w-px flex-1 mt-2 min-h-[2rem] opacity-20 bg-border" />
                )}
              </div>

              <div className="pt-2 pb-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <step.icon className="h-4 w-4 text-primary" />
                  <h3 className="text-lg font-bold">{step.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  )
}
