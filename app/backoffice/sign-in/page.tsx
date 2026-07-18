"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Eye, EyeOff, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import {
  BACKOFFICE_EMAIL_DOMAIN,
  BACKOFFICE_EMAIL_HOSTED_DOMAIN,
} from "@/lib/backoffice/email-domain"
import { backofficeSignin } from "./actions"

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function BackofficeSignInPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const result = await backofficeSignin(formData)

      if (result && !result.success) {
        const apiError =
          (result.errors as Record<string, string>)?.apiError ??
          "Verifique os campos do formulário"
        toast.error(apiError)
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    if (isLoading || isGoogleLoading) return
    setIsGoogleLoading(true)

    try {
      const supabase = createSupabaseBrowser()
      if (!supabase) {
        toast.error("Serviço de autenticação indisponível")
        return
      }

      sessionStorage.setItem(
        "googleConnectContext",
        JSON.stringify({ source: "backoffice-sign-in", next: "/backoffice" })
      )

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/backoffice`,
          queryParams: {
            hd: BACKOFFICE_EMAIL_HOSTED_DOMAIN,
            prompt: "select_account",
          },
        },
      })

      if (error) {
        sessionStorage.removeItem("googleConnectContext")
        toast.error("Falha ao iniciar login com Google")
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const formDisabled = isLoading || isGoogleLoading

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Backoffice</h1>
          <p className="text-sm text-muted-foreground">
            Área restrita — Corretor Studio
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={`nome${BACKOFFICE_EMAIL_DOMAIN}`}
              autoComplete="email"
              required
              disabled={formDisabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={formDisabled}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={formDisabled}>
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="flex items-center gap-4">
          <Separator className="h-px flex-1 shrink opacity-60" />
          <span className="text-xs text-muted-foreground">Ou continue com</span>
          <Separator className="h-px flex-1 shrink opacity-60" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={formDisabled}
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon data-icon="inline-start" />
          {isGoogleLoading ? "Redirecionando..." : "Entrar com Google"}
        </Button>
      </div>
    </main>
  )
}
