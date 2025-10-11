'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import type { SubscriptionInvoice } from '../types/subscription.types';

interface SubscriptionInvoicesProps {
  invoices: SubscriptionInvoice[];
}

export function SubscriptionInvoices({ invoices }: SubscriptionInvoicesProps) {
  
  const getStatusBadge = (status: string) => {
    const statusMap = {
      PENDING: { label: 'Pendente', variant: 'secondary' as const },
      RECEIVED: { label: 'Paga', variant: 'default' as const },
      CONFIRMED: { label: 'Confirmada', variant: 'default' as const },
      OVERDUE: { label: 'Vencida', variant: 'destructive' as const },
      REFUNDED: { label: 'Reembolsada', variant: 'secondary' as const }
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'default' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Faturas
          </CardTitle>
          <CardDescription>Suas faturas aparecerão aqui</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma fatura encontrada
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Histórico de Faturas
        </CardTitle>
        <CardDescription>Suas últimas faturas e pagamentos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div 
              key={invoice.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{invoice.description}</span>
                  {getStatusBadge(invoice.status)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Vencimento: {formatDate(invoice.dueDate)}
                  {invoice.paymentDate && ` • Pago em: ${formatDate(invoice.paymentDate)}`}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-lg font-bold">{formatCurrency(invoice.value)}</span>
                
                {invoice.invoiceUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
