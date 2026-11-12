"use client"

import { div as MotionDiv } from "framer-motion/client"
import { MessageCircleQuestion } from "lucide-react"
import { faqData } from "@/lib/landing/faq-data"
import { QuestionRequestDialogButton } from "./QuestionRequestDialog"
import { useLandingReveal } from "@/lib/landing/use-landing-motion"

export function FaqSection() {
  const motion = useLandingReveal({ distance: 20, duration: 0.6 })

  return (
    <section id="faq" className="bg-landing-warm py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-10">
        <MotionDiv {...motion} className="mb-12 text-center">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.05em] text-primary">
            Dúvidas
          </p>
          <h2 className="mt-3 text-balance font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] text-landing-ink md:text-5xl">
            Perguntas frequentes
          </h2>
        </MotionDiv>

        <div className="flex flex-col gap-3">
          {faqData.map((item, index) => (
            <details key={item.question} className="landing-faq-item" open={index === 0}>
              <summary>
                <span>{item.question}</span>
                <span aria-hidden className="landing-faq-plus" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <p className="text-base text-landing-body">Não encontrou o que procurava?</p>
          <QuestionRequestDialogButton className="landing-secondary-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <MessageCircleQuestion className="size-5" aria-hidden />
            Registrar uma dúvida
          </QuestionRequestDialogButton>
        </div>
      </div>
    </section>
  )
}
