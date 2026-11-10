"use client"

import Link from "next/link"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react"
import { ArrowRight, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { isValidPhone, maskPhone, unmask } from "@/lib/masks"

const inputClassName =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
const labelClassName = "font-display text-sm font-semibold text-landing-ink"
const nameAllowedPattern = /^[\p{L}\p{M}\s'-]+$/u
const questionMaxLength = 1000

type QuestionField = "name" | "email" | "whatsapp" | "question"

const initialTouchedFields: Record<QuestionField, boolean> = {
  name: false,
  email: false,
  whatsapp: false,
  question: false,
}

function isValidName(value: string) {
  const normalizedValue = value.trim()
  const letters = normalizedValue.match(/\p{L}/gu)

  return (letters?.length ?? 0) >= 2 && nameAllowedPattern.test(normalizedValue)
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

type QuestionRequestDialogContextValue = {
  openDialog: () => void
}

const QuestionRequestDialogContext = createContext<QuestionRequestDialogContextValue | null>(null)

function useQuestionRequestDialog() {
  const context = useContext(QuestionRequestDialogContext)

  if (!context) {
    throw new Error("QuestionRequestDialogButton must be used inside QuestionRequestDialogProvider")
  }

  return context
}

export function QuestionRequestDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ openDialog: () => setOpen(true) }), [])

  return (
    <QuestionRequestDialogContext.Provider value={value}>
      {children}
      <QuestionRequestDialog open={open} onOpenChange={setOpen} />
    </QuestionRequestDialogContext.Provider>
  )
}

export function QuestionRequestDialogButton({
  children,
  type = "button",
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { openDialog } = useQuestionRequestDialog()

  return (
    <button
      type={type}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) openDialog()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

type QuestionRequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function QuestionRequestDialog({ open, onOpenChange }: QuestionRequestDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [question, setQuestion] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [touchedFields, setTouchedFields] = useState(initialTouchedFields)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  const resetForm = useCallback(() => {
    setName("")
    setEmail("")
    setWhatsapp("")
    setQuestion("")
    setIsSubmitting(false)
    setIsSuccess(false)
    setTouchedFields(initialTouchedFields)
    setHasAttemptedSubmit(false)
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  const fieldErrors = useMemo(
    () => ({
      name: isValidName(name) ? "" : "Informe seu nome com pelo menos 2 letras.",
      email: isValidEmail(email) ? "" : "Informe um e-mail válido.",
      whatsapp: isValidPhone(whatsapp) ? "" : "Informe um WhatsApp com DDD.",
      question: question.trim().length >= 10 ? "" : "Descreva sua dúvida com pelo menos 10 caracteres.",
    }),
    [email, name, question, whatsapp],
  )

  const isFormValid = Object.values(fieldErrors).every((error) => error.length === 0)

  const markFieldAsTouched = useCallback((field: QuestionField) => {
    setTouchedFields((current) => ({ ...current, [field]: true }))
  }, [])

  const shouldShowFieldError = (field: QuestionField) =>
    Boolean(fieldErrors[field]) && (touchedFields[field] || hasAttemptedSubmit)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setHasAttemptedSubmit(true)

    if (!isFormValid) {
      setTouchedFields({ name: true, email: true, whatsapp: true, question: true })
      return
    }

    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim(),
          question: question.trim(),
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result?.errorMessages?.join(", ") || "Erro ao enviar. Tente novamente.")
        return
      }

      toast.success("Dúvida enviada! Em breve entraremos em contato.")
      setIsSuccess(true)
    } catch (error) {
      toast.error("Erro ao enviar. Tente novamente.")
      console.error("Error submitting question request:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="landing-page max-h-[92vh] !w-[min(560px,calc(100vw-48px))] !max-w-[560px] gap-0 overflow-hidden rounded-[28px] border-0 bg-card p-0 shadow-2xl"
      >
        <DialogClose className="absolute right-4 top-4 z-10 grid size-[38px] place-items-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_8%,var(--card))] text-landing-ink transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="size-5" aria-hidden />
          <span className="sr-only">Fechar</span>
        </DialogClose>
        <DialogTitle className="sr-only">Registrar uma dúvida sobre o Corretor Studio</DialogTitle>
        <DialogDescription className="sr-only">
          Formulário para enviar uma dúvida ao time do Corretor Studio.
        </DialogDescription>

        <div className="max-h-[92vh] overflow-y-auto px-6 py-10 sm:px-[38px]">
          {isSuccess ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="grid size-16 place-items-center rounded-full bg-primary/12 text-primary">
                <CheckCircle2 className="size-8" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-2xl font-extrabold text-landing-ink">
                Dúvida enviada!
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                Recebemos sua mensagem. Nossa equipe responde em até{" "}
                <strong className="font-semibold text-landing-ink">1 dia útil</strong>.
              </p>
              <DialogClose className="landing-primary-cta mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl px-6 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                Fechar
              </DialogClose>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">
                Dúvidas
              </p>
              <h2 className="mt-3 pr-10 font-display text-2xl font-extrabold leading-tight text-landing-ink">
                Conte sua dúvida para a gente
              </h2>
              <p className="mb-6 mt-3 text-sm leading-6 text-muted-foreground">
                Nosso time responde por e-mail ou WhatsApp, sem compromisso.
              </p>

              <FieldGroup className="gap-4">
                <Field className="gap-1.5" data-invalid={shouldShowFieldError("name") ? "true" : undefined}>
                  <FieldLabel htmlFor="question-name" className={labelClassName}>
                    Nome <span className="text-primary">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <input
                      id="question-name"
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      onBlur={() => markFieldAsTouched("name")}
                      autoComplete="name"
                      required
                      aria-invalid={shouldShowFieldError("name") || undefined}
                      className={cn(
                        inputClassName,
                        shouldShowFieldError("name") && "border-destructive focus:ring-destructive",
                      )}
                    />
                    {shouldShowFieldError("name") && (
                      <FieldError className="text-xs">{fieldErrors.name}</FieldError>
                    )}
                  </FieldContent>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field className="gap-1.5" data-invalid={shouldShowFieldError("email") ? "true" : undefined}>
                    <FieldLabel htmlFor="question-email" className={labelClassName}>
                      E-mail <span className="text-primary">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <input
                        id="question-email"
                        type="email"
                        placeholder="voce@empresa.com.br"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onBlur={() => markFieldAsTouched("email")}
                        autoComplete="email"
                        required
                        aria-invalid={shouldShowFieldError("email") || undefined}
                        className={cn(
                          inputClassName,
                          shouldShowFieldError("email") && "border-destructive focus:ring-destructive",
                        )}
                      />
                      {shouldShowFieldError("email") && (
                        <FieldError className="text-xs">{fieldErrors.email}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field className="gap-1.5" data-invalid={shouldShowFieldError("whatsapp") ? "true" : undefined}>
                    <FieldLabel htmlFor="question-whatsapp" className={labelClassName}>
                      WhatsApp <span className="text-primary">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <input
                        id="question-whatsapp"
                        type="tel"
                        placeholder="(11) 90000-0000"
                        value={maskPhone(whatsapp)}
                        onChange={(event) => setWhatsapp(unmask(maskPhone(event.target.value)))}
                        onBlur={() => markFieldAsTouched("whatsapp")}
                        autoComplete="tel"
                        inputMode="tel"
                        required
                        aria-invalid={shouldShowFieldError("whatsapp") || undefined}
                        className={cn(
                          inputClassName,
                          shouldShowFieldError("whatsapp") && "border-destructive focus:ring-destructive",
                        )}
                      />
                      {shouldShowFieldError("whatsapp") && (
                        <FieldError className="text-xs">{fieldErrors.whatsapp}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                </div>

                <Field className="gap-1.5" data-invalid={shouldShowFieldError("question") ? "true" : undefined}>
                  <FieldLabel htmlFor="question-message" className={labelClassName}>
                    Sua dúvida <span className="text-primary">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <textarea
                      id="question-message"
                      rows={4}
                      maxLength={questionMaxLength}
                      placeholder="Escreva aqui o que você gostaria de saber"
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      onBlur={() => markFieldAsTouched("question")}
                      required
                      aria-invalid={shouldShowFieldError("question") || undefined}
                      className={cn(
                        inputClassName,
                        "resize-none",
                        shouldShowFieldError("question") && "border-destructive focus:ring-destructive",
                      )}
                    />
                    {shouldShowFieldError("question") && (
                      <FieldError className="text-xs">{fieldErrors.question}</FieldError>
                    )}
                  </FieldContent>
                </Field>

                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  aria-disabled={!isFormValid || isSubmitting}
                  className="landing-primary-cta inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Enviando..." : "Enviar minha dúvida"}
                  <ArrowRight className="size-5" aria-hidden />
                </button>
              </FieldGroup>

              <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                Ao enviar, você concorda com nossa{" "}
                <Link href="/privacy-policy" className="font-semibold text-primary">
                  Política de Privacidade
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
