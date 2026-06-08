'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, CreditCard, Users, AlertCircle, Layers } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';
import { toast } from 'sonner';
import { useState } from 'react';

interface SubscriptionCardProps {
  subscription: SubscriptionData;
  onCancel: () => Promise<void>;
}

export function SubscriptionCard({ subscription, onCancel }: SubscriptionCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  
  // Verificar se é assinatura vitalícia
  const isPermanentSubscription = subscription.hasPermanentSubscription;
  
  const getStatusBadge = (status: string) => {
    // Para assinatura vitalícia, sempre mostrar badge especial
    if (isPermanentSubscription) {
      return <Badge variant="default" className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">✨ Assinatura Vitalícia</Badge>;
    }
    
    const statusMap = {
      trial: { label: 'Período de Teste', variant: 'default' as const },
      active: { label: 'Ativa', variant: 'default' as const },
      past_due: { label: 'Pagamento Atrasado', variant: 'destructive' as const },
      suspended: { label: 'Suspensa', variant: 'destructive' as const },
      canceled: { label: 'Cancelada', variant: 'secondary' as const }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'default' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const billingSummary = subscription.billingSummary;
  const basePrice = billingSummary?.basePrice ?? 59.9;
  const billableTeams = billingSummary?.billableTeams ?? 0;
  const billableUsers = billingSummary?.billableUsers ?? (subscription.planDetails?.operatorCount ?? 0);
  const hasUnlimitedUsers = billingSummary?.hasUnlimitedUsers === true;
  const extraTeamsPrice = billingSummary?.extraTeamsPrice ?? 0;
  const extraUsersPrice =
    billingSummary?.extraUsersPrice ?? Number(((subscription.planDetails?.operatorCount ?? 0) * 19.9).toFixed(2));
  const totalPrice = billingSummary?.totalPrice ?? subscription.value;
  const extraTeamUnitPrice = billableTeams > 0 ? extraTeamsPrice / billableTeams : 29.9;
  const extraUserUnitPrice = billableUsers > 0 ? extraUsersPrice / billableUsers : 19.9;

  const handleCancel = async () => {
    setIsCanceling(true);
    try {
      await onCancel();
      toast.success('Assinatura cancelada com sucesso');
      setIsDialogOpen(false);
    } catch (_error) {
      toast.error('Erro ao cancelar assinatura');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {isPermanentSubscription ? "Assinatura Vitalícia" : "Sua Assinatura"}
            </CardTitle>
            <CardDescription>{subscription.description}</CardDescription>
          </div>
          {getStatusBadge(subscription.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Renderização condicional: Assinatura Vitalícia vs Normal */}
        {isPermanentSubscription ? (
          /* ASSINATURA VITALÍCIA */
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 p-6 border-2 border-amber-300 dark:border-amber-700">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-amber-500 p-3">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-2">
                    🎉 Você possui acesso vitalício sem custo!
                  </h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mb-4">
                    Sua conta tem benefícios permanentes e não requer pagamento mensal. Aproveite
                    todos os recursos sem limitações!
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="rounded-full bg-amber-500/20 p-2">
                        <CreditCard className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          Valor Mensal:
                        </span>
                        <span className="ml-2 font-bold text-amber-900 dark:text-amber-100">
                          R$ 0,00
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="rounded-full bg-amber-500/20 p-2">
                        <Layers className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          Times:
                        </span>
                        <span className="ml-2 font-bold text-amber-900 dark:text-amber-100">
                          {billingSummary?.teamCount ?? 0}{" "}
                          {(billingSummary?.teamCount ?? 0) === 1 ? "time" : "times"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="rounded-full bg-amber-500/20 p-2">
                        <Users className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          Usuários (distinct):
                        </span>
                        <span className="ml-2 font-bold text-amber-900 dark:text-amber-100">
                          {billingSummary?.distinctUserCount ?? billableUsers}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <div className="rounded-full bg-amber-500/20 p-2">
                        <Calendar className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          Validade:
                        </span>
                        <span className="ml-2 font-bold text-amber-900 dark:text-amber-100">
                          Sem vencimento
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Cliente */}
            <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold">{subscription.customer.name}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-semibold">{subscription.customer.email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Tipo de Assinatura:</span>
                  <span className="font-semibold">Vitalícia</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Benefícios:</span>
                  <span className="font-semibold">Ilimitados</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ASSINATURA NORMAL */
          <>
            {/* Informações da Assinatura */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Base (1 time):</span>
                  <span className="font-semibold">{formatCurrency(basePrice)}</span>
                </div>

                {billableTeams > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Times adicionais ({billableTeams} × {formatCurrency(extraTeamUnitPrice)}):
                    </span>
                    <span className="font-semibold">{formatCurrency(extraTeamsPrice)}</span>
                  </div>
                )}

                {hasUnlimitedUsers && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Usuários adicionais:</span>
                    <span className="font-semibold">Ilimitados</span>
                  </div>
                )}

                {!hasUnlimitedUsers && billableUsers > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Usuários adicionais ({billableUsers} × {formatCurrency(extraUserUnitPrice)}):
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(extraUsersPrice)}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm pt-2 border-t">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Valor Mensal Total:</span>
                  <span className="font-bold text-lg">{formatCurrency(totalPrice)}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Próximo Vencimento:</span>
                  <span className="font-semibold">{formatDate(subscription.nextDueDate)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-semibold">{subscription.customer.name}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-semibold">{subscription.customer.email}</span>
                </div>

                {subscription.planDetails?.trialEndDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Fim do Trial:</span>
                    <span className="font-semibold">
                      {formatDate(subscription.planDetails.trialEndDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Ações - apenas para assinatura normal */}
        {!isPermanentSubscription && (
          <div className="flex gap-2 pt-4 border-t">
            {/* <Button variant="outline" size="sm">
              Atualizar Método de Pagamento
            </Button> */}
            {subscription.status !== "canceled" && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="cursor-pointer bg-red-500 hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600"
                    size="sm"
                  >
                    Cancelar Assinatura
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancelar Assinatura</DialogTitle>
                    <DialogDescription>
                      Tem certeza que deseja cancelar sua assinatura?
                      <br />
                      <br />
                      Ao cancelar, você perderá acesso aos recursos da plataforma e seus operadores
                      não poderão mais usar o sistema.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="default"
                      className="cursor-pointer"
                      onClick={() => setIsDialogOpen(false)}
                      disabled={isCanceling}
                    >
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      className="cursor-pointer bg-red-500 hover:bg-red-600 dark:bg-red-500 dark:hover:bg-red-600"
                      onClick={handleCancel}
                      disabled={isCanceling}
                    >
                      {isCanceling ? "Cancelando..." : "Confirmar Cancelamento"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
