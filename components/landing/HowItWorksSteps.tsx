"use client"

import { div as MotionDiv } from "framer-motion/client"
import { stepsData } from "@/lib/landing/steps-data"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

export function HowItWorksSteps() {
  const motion = useLandingReveal({ distance: 20, duration: 0.6 })

  return (
    <section id="como" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...motion} className="mb-12 max-w-3xl">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.05em] text-primary">
            Como funciona
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] text-landing-ink md:text-5xl">
            Do caos ao controle: gerencie toda a jornada do cliente em cinco passos
          </h2>
        </MotionDiv>

        <ol className="landing-steps-grid">
          {stepsData.map((step, index) => (
            <li key={step.title} className="landing-step">
              <span
                aria-hidden
                className="landing-step-number pointer-events-none absolute -left-2 -top-0.5 font-display text-5xl font-extrabold leading-none text-primary opacity-[0.16]"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="relative z-[1] font-display text-lg font-bold tracking-[-0.02em] text-landing-ink">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-landing-body">{step.description}</p>
              <span aria-hidden className="mt-5 block h-px w-full bg-landing-step-line" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
