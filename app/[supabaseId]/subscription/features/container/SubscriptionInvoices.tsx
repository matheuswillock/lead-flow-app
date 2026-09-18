'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Search, CreditCard } from 'lucide-react';
import type { SubscriptionInvoice } from '../types/subscription.types';
import { useTimezone } from '@/app/context/TimezoneContext';
import { formatIntimezone, parseDateKeyToUtc } from '@/lib/dates';
import { formatCurrency } from './subscription-format';

interface SubscriptionInvoicesProps {
  invoices: SubscriptionInvoice[];
  /** DA3: falha ao carregar faturas, distinta do array vazio real. */
  error?: string | null;
  onRetry?: () => void;
}

const PAYABLE_STATUSES = new Set(['OVERDUE', 'PENDING']);

export function SubscriptionInvoices({ invoices, error, onRetry }: SubscriptionInvoicesProps) {
  const { tz } = useTimezone();
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
    return formatIntimezone(parseDateKeyToUtc(dateString, tz), 'dd/MM/yyyy', tz);
  };

  const invoicesWithYear = useMemo(
    () =>
      invoices.map((invoice) => {
        const referenceDate = invoice.dueDate || invoice.paymentDate || '';
        const parsed = referenceDate ? parseDateKeyToUtc(referenceDate, tz) : null;
        const year = parsed ? formatIntimezone(parsed, 'yyyy', tz) : 'Sem ano';

        return {
          ...invoice,
          year,
        };
      }),
    [invoices, tz]
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

  // DA3: erro de fetch nunca pode se disfarçar de "sem faturas" — card
  // dedicado com retry, antes de qualquer checagem de lista vazia.
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Histórico de Faturas
          </CardTitle>
          <CardDescription>Não foi possível carregar suas faturas</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
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
          <FileText className="size-5" />
          Histórico de Faturas
        </CardTitle>
        <CardDescription>Suas últimas faturas e pagamentos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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

          {filteredInvoices.map((invoice) => {
            // E5: fatura vencida/pendente ganha ação primária "Pagar fatura"
            // apontando para `invoiceUrl` (página de pagamento do Asaas) — a
            // ação mais importante da tela não pode ficar rotulada "Baixar".
            const isPayable = PAYABLE_STATUSES.has(invoice.status);

            return (
              <div
                key={invoice.id}
                className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{invoice.description}</span>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Vencimento: {formatDate(invoice.dueDate)}
                    {invoice.paymentDate && ` • Pago em: ${formatDate(invoice.paymentDate)}`}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-bold">{formatCurrency(invoice.value)}</span>

                  {isPayable && invoice.invoiceUrl && (
                    <Button size="sm" asChild>
                      <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                        <CreditCard data-icon="inline-start" />
                        Pagar fatura
                      </a>
                    </Button>
                  )}

                  {invoice.bankSlipUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={invoice.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                        <Download data-icon="inline-start" />
                        Baixar
                      </a>
                    </Button>
                  )}

                  {!isPayable && !invoice.bankSlipUrl && invoice.invoiceUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer">
                        <Download data-icon="inline-start" />
                        Baixar
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
