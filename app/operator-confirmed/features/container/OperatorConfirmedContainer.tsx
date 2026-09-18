"use client";

import { AlertCircle, CheckCircle2, Loader2, RotateCcw, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useOperatorConfirmed } from "../context/OperatorConfirmedHook";
import type { PendingOperatorData } from "../context/OperatorConfirmedTypes";

function paymentStatusBadgeClassName(paymentStatus: string): string {
  if (paymentStatus === "CONFIRMED") return "border-success/30 bg-success/10 text-success";
  if (paymentStatus === "PENDING") return "border-warning/30 bg-warning/10 text-warning";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

export function OperatorConfirmedContainer() {
  const { state, retryFetch, goToLogin, goToDashboard } = useOperatorConfirmed();
  const { step, operatorData, error, pollCapped } = state;

  const statusDisplay = getStatusDisplay({ step, operatorData, error, pollCapped });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">{statusDisplay.icon}</div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">{statusDisplay.title}</CardTitle>
            <CardDescription className="text-base">{statusDisplay.description}</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="gap-6 flex flex-col">
          {operatorData && (
            <div className={cn("rounded-lg p-4", statusDisplay.panelClassName)}>
              <h3 className="flex items-center gap-2 font-semibold">
                <UserPlus className="size-5" />
                Detalhes do Operador
              </h3>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{operatorData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-medium">{operatorData.email}</span>
                </div>
              </div>
            </div>
          )}

          {operatorData?.paymentId && (
            <div className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Referência do Pagamento
              </h4>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ID do Pagamento:</span>
                <code className="rounded bg-muted px-2 py-1 text-xs">
                  {operatorData.paymentId.substring(0, 20)}...
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={paymentStatusBadgeClassName(operatorData.paymentStatus)}>
                  {operatorData.paymentStatus}
                </Badge>
              </div>
            </div>
          )}

          {operatorData?.operatorCreated && (
            <>
              <Separator />
              <div className="flex flex-col gap-4">
                <h4 className="font-semibold">Próximos Passos:</h4>
                <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>O operador receberá um e-mail com as credenciais de acesso</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Ele poderá fazer login e começar a trabalhar imediatamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Você pode gerenciar todos os operadores na página de gerenciamento</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {operatorData?.paymentStatus === "PENDING" && !operatorData.operatorCreated && !pollCapped && (
            <>
              <Separator />
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Aguarde alguns instantes. Esta página é atualizada automaticamente quando o pagamento for confirmado.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                  <span>Verificando status do pagamento...</span>
                </div>
              </div>
            </>
          )}

          {pollCapped && (
            <>
              <Separator />
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Ainda não confirmamos seu pagamento. Você pode verificar novamente ou voltar mais tarde — avisaremos por e-mail assim que confirmarmos.
                </p>
                <Button onClick={retryFetch} variant="outline" size="sm" className="h-11">
                  <RotateCcw data-icon="inline-start" />
                  Verificar novamente
                </Button>
              </div>
            </>
          )}

          {step === "error" && (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button onClick={retryFetch} className="h-11 flex-1" size="lg">
                Tentar novamente
              </Button>
              <Button onClick={goToLogin} variant="outline" className="h-11 flex-1" size="lg">
                Ir para o login
              </Button>
            </div>
          )}

          {step === "ready" && operatorData && (
            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button onClick={goToDashboard} className="h-11 flex-1" size="lg">
                {operatorData.operatorCreated ? "Ir para Gerenciar Usuários" : "Voltar ao Dashboard"}
              </Button>

              {operatorData.paymentStatus === "FAILED" && (
                <Button onClick={goToLogin} variant="outline" className="h-11 flex-1" size="lg">
                  Ir para o login
                </Button>
              )}
            </div>
          )}

          <Separator />
          <div className="text-center text-xs text-muted-foreground">
            {operatorData?.operatorCreated && <p>Dúvidas? Entre em contato com nosso suporte.</p>}
            {operatorData?.paymentStatus === "FAILED" && (
              <p>Se o problema persistir, entre em contato com nosso suporte.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

interface StatusDisplayInput {
  step: "loading" | "error" | "ready";
  operatorData: PendingOperatorData | null;
  error: string | null;
  pollCapped: boolean;
}

interface StatusDisplay {
  icon: React.ReactNode;
  title: string;
  description: string;
  panelClassName: string;
}

function getStatusDisplay({ step, operatorData, error, pollCapped }: StatusDisplayInput): StatusDisplay {
  if (step === "loading") {
    return {
      icon: <Loader2 className="size-20 animate-spin text-primary motion-reduce:animate-none" />,
      title: "Carregando...",
      description: "Buscando informações do operador...",
      panelClassName: "bg-primary/5",
    };
  }

  if (step === "error") {
    return {
      icon: <AlertCircle className="size-20 text-destructive" />,
      title: "Erro",
      description: error ?? "Erro ao carregar dados",
      panelClassName: "bg-destructive/10",
    };
  }

  if (!operatorData) {
    return {
      icon: <AlertCircle className="size-20 text-warning" />,
      title: "Operador não encontrado",
      description: "Não foi possível encontrar as informações do operador.",
      panelClassName: "bg-warning/10",
    };
  }

  if (operatorData.operatorCreated) {
    return {
      icon: <CheckCircle2 className="size-20 text-success" />,
      title: "Operador Adicionado com Sucesso!",
      description: "O novo operador foi criado e receberá um e-mail com as credenciais de acesso.",
      panelClassName: "bg-success/10",
    };
  }

  if (operatorData.paymentStatus === "CONFIRMED") {
    return {
      icon: <CheckCircle2 className="size-20 text-success" />,
      title: "Pagamento Confirmado!",
      description: "Estamos criando o operador. Aguarde alguns instantes...",
      panelClassName: "bg-success/10",
    };
  }

  if (operatorData.paymentStatus === "PENDING" && pollCapped) {
    return {
      icon: <AlertCircle className="size-20 text-warning" />,
      title: "Ainda Verificando",
      description: "Não confirmamos o pagamento dentro do tempo esperado.",
      panelClassName: "bg-warning/10",
    };
  }

  if (operatorData.paymentStatus === "PENDING") {
    return {
      icon: <Loader2 className="size-20 animate-spin text-warning motion-reduce:animate-none" />,
      title: "Aguardando Confirmação",
      description: "O pagamento está sendo processado. O operador será criado assim que confirmarmos o pagamento.",
      panelClassName: "bg-warning/10",
    };
  }

  return {
    icon: <AlertCircle className="size-20 text-destructive" />,
    title: "Pagamento Não Confirmado",
    description: "Não foi possível confirmar o pagamento. Tente novamente ou entre em contato com o suporte.",
    panelClassName: "bg-destructive/10",
  };
}
