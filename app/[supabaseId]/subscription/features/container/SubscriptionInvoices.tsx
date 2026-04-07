'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Search } from 'lucide-react';
import type { SubscriptionInvoice } from '../types/subscription.types';

interface SubscriptionInvoicesProps {
  invoices: SubscriptionInvoice[];
}

export function SubscriptionInvoices({ invoices }: SubscriptionInvoicesProps) {
  const [query, setQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');

  const getStatusInfo = (status: string) => {
    const statusMap = {
      PENDING: { label: 'Pendente', variant: 'secondary' as const },
      RECEIVED: { label: 'Paga', variant: 'default' as const },
      CONFIRMED: { label: 'Confirmada', variant: 'default' as const },
      OVERDUE: { label: 'Vencida', variant: 'destructive' as const },
      REFUNDED: { label: 'Reembolsada', variant: 'secondary' as const }
    };

    return statusMap[status as keyof typeof statusMap] || {
      label: status,
      variant: 'default' as const,
    };
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = getStatusInfo(status);
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

  const invoicesWithYear = useMemo(
    () =>
      invoices.map((invoice) => {
        const referenceDate = invoice.dueDate || invoice.paymentDate || '';
        const parsed = referenceDate ? new Date(referenceDate) : null;
        const year = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getFullYear()) : 'Sem ano';

        return {
          ...invoice,
          year,
        };
      }),
    [invoices]
  );

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(invoicesWithYear.map((invoice) => invoice.year)));

    return uniqueYears.sort((a, b) => {
      if (a === 'Sem ano') return 1;
      if (b === 'Sem ano') return -1;
      return Number(b) - Number(a);
    });
  }, [invoicesWithYear]);

  useEffect(() => {
    if (selectedYear !== 'all' && !years.includes(selectedYear)) {
      setSelectedYear('all');
    }
  }, [selectedYear, years]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredInvoices = useMemo(
    () =>
      invoicesWithYear.filter((invoice) => {
        const matchesYear = selectedYear === 'all' || invoice.year === selectedYear;
        if (!matchesYear) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const statusInfo = getStatusInfo(invoice.status);
        const searchableText = [
          invoice.description,
          invoice.invoiceNumber || '',
          invoice.status,
          statusInfo.label,
          formatDate(invoice.dueDate),
          invoice.paymentDate ? formatDate(invoice.paymentDate) : '',
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      }),
    [invoicesWithYear, normalizedQuery, selectedYear]
  );

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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar fatura por descrição, número ou status"
                className="h-9 pl-9"
              />
            </div>

            <Tabs value={selectedYear} onValueChange={setSelectedYear} className="w-full lg:w-auto">
              <TabsList className="h-9 w-full justify-start lg:w-auto">
                <TabsTrigger value="all">Todos</TabsTrigger>
                {years.map((year) => (
                  <TabsTrigger key={year} value={year}>
                    {year}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Nenhuma fatura encontrada para os filtros selecionados.
            </div>
          ) : null}

          {filteredInvoices.map((invoice) => (
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
