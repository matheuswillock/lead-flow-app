"use client"

import { Lock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParams } from "next/navigation"

interface SubscriptionGuardProps {
  children: React.ReactNode
  hasActiveSubscription: boolean
  isLoading?: boolean
}

export function SubscriptionGuard({ children, hasActiveSubscription, isLoading }: SubscriptionGuardProps) {
  const params = useParams()
  const supabaseId = params.supabaseId as string

  // Enquanto carrega, não bloquear a UI para evitar falso negativo
  if (isLoading) {
    return <>{children}</>
  }

  if (hasActiveSubscription) {
    return <>{children}</>
  }

  return (
    <div className="relative h-full w-full">
      {/* Conteúdo desfocado no fundo */}
      <div className="pointer-events-none blur-sm opacity-30">
        {children}
      </div>

      {/* Overlay com efeito glassmorphism */}
      <div className="absolute inset-0 flex items-center justify-center backdrop-blur-md bg-background/40">
        <Card className="w-full max-w-lg mx-4 shadow-2xl border-2">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">
              Assinatura Inativa
            </CardTitle>
            <CardDescription className="text-base">
              Você não possui uma assinatura ativa para acessar este conteúdo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground text-center">
              <p>
                Para desbloquear todas as funcionalidades do Corretor Studio, você precisa de uma assinatura ativa.
              </p>
              <p className="font-semibold text-foreground">
                Assine agora e tenha acesso completo!
              </p>
            </div>
            
            <div className="flex flex-col gap-3 pt-4">
              <Button asChild size="lg" className="w-full">
                <Link href={`/${supabaseId}/subscription`}>
                  Gerenciar Assinatura
                </Link>
              </Button>
            </div>

            <div className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Você ainda pode acessar suas{" "}
                <Link
                  href={`/${supabaseId}/account`}
                  className="text-primary hover:underline font-medium"
                >
                  configurações de conta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
