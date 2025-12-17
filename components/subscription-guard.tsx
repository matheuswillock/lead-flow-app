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
  userRole?: string // 'manager' ou 'operator'
}

export function SubscriptionGuard({ children, hasActiveSubscription, isLoading, userRole }: SubscriptionGuardProps) {
  const params = useParams()
  const supabaseId = params.supabaseId as string

  // Enquanto carrega, não bloquear a UI para evitar falso negativo
  if (isLoading) {
    return <>{children}</>
  }

  if (hasActiveSubscription) {
    return <>{children}</>
  }

  // Mensagens específicas por tipo de usuário
  const isOperator = userRole === 'operator'
  const isManager = userRole === 'manager'
  
  const title = isOperator || isManager
    ? "Sem Acesso à Plataforma"
    : "Assinatura Inativa"
  
  const description = isOperator
    ? "Você é um operador e não possui acesso pois o seu manager não possui assinatura ativa."
    : isManager
    ? "Você é um manager e não possui acesso pois o seu master não possui assinatura ativa."
    : "Você não possui uma assinatura ativa para acessar este conteúdo."
  
  const actionText = isOperator || isManager
    ? "Entre em contato com seu administrador"
    : "Assine agora e tenha acesso completo!"

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
              {title}
            </CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground text-center">
              {isOperator || isManager ? (
                <>
                  <p>
                    {isOperator 
                      ? "Seu manager precisa ter uma assinatura ativa para que você possa utilizar a plataforma."
                      : "Seu master precisa ter uma assinatura ativa para que você possa utilizar a plataforma."
                    }
                  </p>
                  <p className="font-semibold text-foreground">
                    {actionText}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Para desbloquear todas as funcionalidades do Corretor Studio, você precisa de uma assinatura ativa.
                  </p>
                  <p className="font-semibold text-foreground">
                    {actionText}
                  </p>
                </>
              )}
            </div>
            
            <div className="flex flex-col gap-3 pt-4">
              {!(isOperator || isManager) && (
                <Button asChild size="lg" className="w-full">
                  <Link href={`/${supabaseId}/subscription`}>
                    Gerenciar Assinatura
                  </Link>
                </Button>
              )}
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
