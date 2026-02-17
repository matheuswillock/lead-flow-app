"use client"

import { useMemo, useState, type FormEvent } from "react"
import { div as MotionDiv } from "framer-motion/client"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { isValidPhone, maskPhone, unmask } from "@/lib/masks"

export function PricingSection() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const isFormValid = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      isValidEmail(email.trim()) &&
      isValidPhone(whatsapp)
    )
  }, [fullName, email, whatsapp])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isFormValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        const message =
          (result?.errorMessages && result.errorMessages.join(", ")) ||
          "Erro ao enviar. Tente novamente."
        toast.error(message)
        return
      }

      toast.success("Solicitação enviada! Em breve entraremos em contato.")
      setFullName("")
      setEmail("")
      setWhatsapp("")
    } catch (error) {
      toast.error("Erro ao enviar. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="demo" className="relative py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(40% 40% at 50% 50%, color-mix(in oklab, var(--primary) 20%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Agende uma <span className="text-primary">demonstração</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Fale com um especialista e veja o Corretor Studio em ação.
          </p>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl"
        >
          <div
            className="rounded-3xl border p-8 sm:p-10 shadow-2xl backdrop-blur"
            style={{
              borderColor: "var(--border)",
              background: "color-mix(in oklab, var(--card) 90%, transparent)",
            }}
          >
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="text-sm font-semibold text-foreground/90">
                  Nome completo
                </label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground/90">
                  E-mail profissional
                </label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground/90">
                  WhatsApp
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={maskPhone(whatsapp)}
                  onChange={(event) => {
                    const masked = maskPhone(event.target.value)
                    const unmasked = unmask(masked)
                    setWhatsapp(unmasked)
                  }}
                  required
                  className="mt-2 w-full rounded-2xl border bg-transparent px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>

              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full inline-flex items-center justify-center rounded-2xl px-5 py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                {isSubmitting ? "Enviando..." : "Agendar demonstração"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </form>
          </div>
        </MotionDiv>
      </div>
    </section>
  )
}
