'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowRight } from 'lucide-react';

interface ActiveSubscriptionMessageProps {
  userExists: boolean;
  userId?: string;
  subscription?: {
    status: string;
    value?: number;
    nextDueDate?: string;
  };
}

export function ActiveSubscriptionMessage({
  userExists,
  userId,
  subscription,
}: ActiveSubscriptionMessageProps) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Assinatura Ativa Encontrada</CardTitle>
          <CardDescription className="text-base mt-2">
            Identificamos que você já possui uma assinatura ativa no Lead Flow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription && (
            <div className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {subscription.status === 'ACTIVE' ? 'Ativa' : subscription.status}
                </span>
              </div>
              {subscription.value && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Valor:</span>
                  <span className="font-semibold">
                    R$ {subscription.value.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
              {subscription.nextDueDate && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Próximo vencimento:</span>
                  <span className="font-semibold">
                    {new Date(subscription.nextDueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-center text-muted-foreground">
              Para acessar sua conta e gerenciar sua assinatura, faça login abaixo:
            </p>
            
            <Button asChild className="w-full" size="lg">
              <Link href="/sign-in">
                Fazer Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                Voltar para Home
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Se você acredita que isso é um erro ou precisa de ajuda, entre em contato com nosso suporte.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
