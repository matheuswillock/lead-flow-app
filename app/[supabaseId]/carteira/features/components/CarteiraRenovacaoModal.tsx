"use client";

import { useEffect, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useCarteiraContext } from '../context/CarteiraContext';
import {
  type CarteiraDetailDependent,
  type CarteiraRow,
  type RenewalStatus,
} from '../context/CarteiraTypes';
import { CarteiraActivityFeed } from './CarteiraActivityFeed';
import { RenewalStatusButton } from './RenewalStatusSelect';

const STATUS_STEP_ORDER: RenewalStatus[] = ['to_renew', 'contacted', 'proposal', 'renewed'];

const TIMELINE_STEPS = [
  { label: 'Contato inicial',      status: 'to_renew'  as RenewalStatus },
  { label: 'Estudo em andamento',  status: 'contacted' as RenewalStatus },
  { label: 'Proposta apresentada', status: 'proposal'  as RenewalStatus },
  { label: 'Renovado',             status: 'renewed'   as RenewalStatus },
];

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

function formatCurrencyInput(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Máscara baseada em centavos: digita-se só números e o valor é formatado como R$.
function formatCurrencyDisplay(value: string): string {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  return (parseInt(numbers) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseFormattedValue(value: string): number {
  const numbers = value.replace(/\D/g, '');
  return parseInt(numbers || '0') / 100;
}

function computeReajustePercent(saleValue: number, renewalAmount: number | null): number | null {
  if (renewalAmount == null || saleValue <= 0) return null;
  return ((renewalAmount - saleValue) / saleValue) * 100;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1).replace('.', ',')}%`;
}

function DueDateDisplay({ date }: { date: string | null }) {
  if (!date) return <span className="text-sm text-muted-foreground">—</span>;
  const days = differenceInCalendarDays(new Date(date), new Date());
  const isExpired = days < 0;
  const isSoon = days >= 0 && days <= 90;
  const colorClass =
    isExpired ? 'text-semantic-danger' :
    isSoon    ? 'text-semantic-warning' : 'text-foreground';
  const label = isExpired ? 'Vencido' : isSoon ? 'Expira em breve' : null;

  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('text-sm font-semibold', colorClass)}>{formatDate(date)}</span>
      {label && <span className={cn('text-[10px] font-semibold', colorClass)}>{label}</span>}
    </div>
  );
}

function TimelineSection({ status }: { status: RenewalStatus }) {
  const activeIndex = STATUS_STEP_ORDER.indexOf(status);
  const isLost = status === 'lost';

  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Linha do tempo da renovação
      </p>
      <div className="flex flex-col">
        {TIMELINE_STEPS.map((step, i) => {
          const isDone = !isLost && activeIndex > i;
          const isActive = !isLost && activeIndex === i;
          const isPending = isLost || activeIndex < i;

          return (
            <div key={step.status} className="flex gap-3 pb-4 last:pb-0">
              <div className="relative flex w-6 shrink-0 justify-center">
                {i < TIMELINE_STEPS.length - 1 && (
                  <span
                    className={cn(
                      'absolute top-6 -bottom-4 left-1/2 w-0.5 -translate-x-1/2',
                      isDone ? 'bg-semantic-success' : 'bg-border',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-bold',
                    isDone   && 'border-semantic-success bg-semantic-success text-white',
                    isActive && 'border-primary text-primary bg-background shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]',
                    isPending && 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {isDone ? '✓' : i + 1}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 pt-0.5">
                <p className={cn('text-sm font-semibold', isPending && 'text-muted-foreground')}>
                  {step.label}
                </p>
                <p className={cn('text-xs', isActive && 'font-semibold text-primary', !isActive && 'text-muted-foreground')}>
                  {isDone ? 'Concluído' : isActive ? 'Em andamento' : 'Pendente'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {isLost && (
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-semantic-danger-border bg-semantic-danger-surface px-2.5 py-1.5 text-xs font-semibold text-semantic-danger">
          Renovação perdida
        </div>
      )}
    </section>
  );
}

function DependentsSection({ dependents, loading }: { dependents: CarteiraDetailDependent[]; loading: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Dependentes
      </p>
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : dependents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum dependente cadastrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {dependents.map((dep) => (
            <div key={dep.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium">{dep.name}</span>
                <span className="text-xs text-muted-foreground">Nascimento: {formatDate(dep.birthDate)}</span>
              </div>
              <Badge variant="outline" className="text-xs capitalize">{dep.parentesco}</Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface CarteiraRenovacaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CarteiraRow | null;
  status: RenewalStatus;
  onStatusChange: (portfolioId: string, status: RenewalStatus) => void;
}

export function CarteiraRenovacaoModal({
  open,
  onOpenChange,
  row,
  status,
  onStatusChange,
}: CarteiraRenovacaoModalProps) {
  const { updateEntry, getEntryDetail } = useCarteiraContext();

  const [novoValor, setNovoValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [dependents, setDependents] = useState<CarteiraDetailDependent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const leadId = row?.leadId ?? null;
  const portfolioId = row?.portfolioId ?? null;

  // Reset inputs quando o card aberto muda.
  useEffect(() => {
    if (!open || !row) return;
    setNovoValor(row.renewalAmount != null ? formatCurrencyInput(row.renewalAmount) : '');
    setDescricao(row.note ?? '');
  }, [open, portfolioId, row]);

  // Buscar dependentes do detalhe.
  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    setDetailLoading(true);
    getEntryDetail(leadId)
      .then((detail) => {
        if (!cancelled) setDependents(detail.dependents);
      })
      .catch(() => {
        if (!cancelled) setDependents([]);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, leadId, getEntryDetail]);

  if (!row) return null;

  const parsedNovoValor = parseFormattedValue(novoValor);
  const renewalAmountPreview = parsedNovoValor > 0 ? parsedNovoValor : null;
  const reajuste = computeReajustePercent(row.saleValue, renewalAmountPreview);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateEntry(row.leadId, {
        renewalAmount: renewalAmountPreview,
        note: descricao.trim() || null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar renovação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-transparent border-none shadow-none p-0 w-[92vw] max-w-[92vw] sm:w-[85vw] sm:max-w-[85vw] lg:w-[60vw] lg:max-w-[60vw] max-h-[90vh] [&>button]:hidden">
        <DialogTitle className="sr-only">Renovação — {row.leadName}</DialogTitle>
        <DialogDescription className="sr-only">
          Detalhes de renovação para o cliente {row.leadName}
        </DialogDescription>

        <div className="flex h-[90vh] max-h-[90vh] flex-col gap-2 lg:flex-row lg:items-stretch">
          {/* Card esquerdo: renovação */}
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-xl border border-border/60 bg-card p-6 shadow-sm lg:h-[95%] lg:max-h-[95%] lg:flex-[1_1_0%] lg:self-center">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b pb-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold leading-tight">{row.leadName}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono text-xs text-muted-foreground">{row.leadCode}</code>
                  {row.operadora && <span className="text-xs font-medium text-foreground">{row.operadora}</span>}
                </div>
              </div>
              <RenewalStatusButton
                portfolioId={row.portfolioId}
                value={status}
                onStatusChange={onStatusChange}
              />
            </div>

            {/* Renovação */}
            <section className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Renovação
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Vencimento</p>
                  <DueDateDisplay date={row.contractDueDate} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Reajuste</p>
                  {reajuste === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className={cn('text-sm font-semibold', reajuste >= 0 ? 'text-semantic-success' : 'text-semantic-danger')}>
                      {formatPercent(reajuste)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Valor atual</p>
                  <span className={cn('text-sm', renewalAmountPreview != null ? 'line-through text-muted-foreground' : 'font-semibold')}>
                    {formatBRL(row.saleValue)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="renewal-amount" className="text-xs text-muted-foreground">Valor renovado</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="renewal-amount"
                      value={novoValor}
                      onChange={(e) => setNovoValor(formatCurrencyDisplay(e.target.value))}
                      placeholder="0,00"
                      className="h-8 pl-9 text-sm"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="renewal-note" className="text-xs text-muted-foreground">Descrição</Label>
                <Textarea
                  id="renewal-note"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Anotações sobre a renovação..."
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </section>

            <Separator />

            <DependentsSection dependents={dependents} loading={detailLoading} />

            <Separator />

            <TimelineSection status={status} />
          </div>

          {/* Card direito: feed */}
          <div className="relative flex min-h-0 flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm lg:h-[95%] lg:max-h-[95%] lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] lg:self-center">
            <DialogClose asChild>
              <Button type="button" size="icon" variant="ghost" className="absolute right-3 top-3 size-8">
                <X className="size-4" />
              </Button>
            </DialogClose>
            <CarteiraActivityFeed leadId={row.leadId} open={open} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
