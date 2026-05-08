"use client";

import { useMemo, useState } from 'react';
import { Award, Download, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceContext } from '../context/PerformanceContext';
import type {
  PerformanceDrilldownEntry,
  PerformanceRankingEntry,
} from '../context/PerformanceTypes';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function RankingRow({
  index,
  maxValue,
  entry,
  suffix,
  roleLabel,
  onOpen,
}: {
  index: number;
  maxValue: number;
  entry: PerformanceRankingEntry;
  suffix: 'vendas' | 'agend.';
  roleLabel: 'Closer' | 'SDR';
  onOpen: (profileId: string, roleLabel: 'Closer' | 'SDR') => void;
}) {
  const progress = maxValue > 0 ? (entry.count / maxValue) * 100 : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry.profileId, roleLabel)}
      className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 hover:border-border hover:bg-muted/30"
    >
      <div className="w-6 text-center text-sm text-muted-foreground">{index + 1}</div>
      <Avatar className="size-9">
        <AvatarFallback>{initials(entry.name)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="text-xs text-muted-foreground">
          {entry.meetingsHeld} reuniões realizadas · {entry.attendanceRate.toFixed(1)}% presença
        </p>
      </div>
      <div className="flex w-40 flex-col items-end gap-1">
        <p className="text-2xl font-semibold leading-none">
          {entry.count}
          <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>
        </p>
        <div className="h-2 w-full rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </button>
  );
}

function RankingCard({
  title,
  subtitle,
  suffix,
  entries,
  roleLabel,
  onOpen,
}: {
  title: string;
  subtitle: string;
  suffix: 'vendas' | 'agend.';
  entries: PerformanceRankingEntry[];
  roleLabel: 'Closer' | 'SDR';
  onOpen: (profileId: string, roleLabel: 'Closer' | 'SDR') => void;
}) {
  const maxValue = useMemo(() => Math.max(...entries.map((entry) => entry.count), 0), [entries]);

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-2 py-1 text-xs">
            <Award />
            Ranking
          </Badge>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-semibold leading-none">{title}</p>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Download data-icon="inline-start" />
          Exportar
        </Button>
      </div>
      <Separator />
      <div className="flex flex-col gap-1 p-2">
        {entries.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          entries.map((entry, index) => (
            <RankingRow
              key={`${roleLabel}:${entry.profileId}`}
              index={index}
              maxValue={maxValue}
              entry={entry}
              suffix={suffix}
              roleLabel={roleLabel}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DrilldownDialog({
  selected,
  onClose,
}: {
  selected: PerformanceDrilldownEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] flex flex-col">
        {selected ? (
          <>
            <DialogHeader>
              <DialogTitle>{selected.name}</DialogTitle>
              <DialogDescription>{selected.email || 'Sem e-mail informado'}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-3 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Função</p>
                    <p className="text-xl font-semibold">{selected.roleLabel}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Vendas</p>
                    <p className="text-xl font-semibold">{selected.salesCount}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Agendamentos</p>
                    <p className="text-xl font-semibold">{selected.scheduledLeads}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Reuniões realizadas</p>
                    <p className="text-xl font-semibold">{selected.meetingsHeld}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">No-show</p>
                    <p className="text-xl font-semibold">{selected.noShowRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Presença</p>
                    <p className="text-xl font-semibold">{selected.attendanceRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Receita atribuída</p>
                  <p className="text-xl font-semibold">
                    {selected.totalSalesValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                <X data-icon="inline-start" />
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function PerformanceRankings() {
  const { data, isLoading } = usePerformanceContext();
  const [selected, setSelected] = useState<PerformanceDrilldownEntry | null>(null);

  const drilldownByProfile = useMemo(() => {
    const map = new Map<string, PerformanceDrilldownEntry>();
    (data?.drilldown ?? []).forEach((item) => map.set(`${item.roleLabel}:${item.profileId}`, item));
    return map;
  }, [data]);

  const handleOpen = (profileId: string, roleLabel: 'Closer' | 'SDR') => {
    const item = drilldownByProfile.get(`${roleLabel}:${profileId}`) ?? null;
    setSelected(item);
  };

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RankingCard
          title="Ranking de Closers"
          subtitle="Por vendas fechadas"
          suffix="vendas"
          roleLabel="Closer"
          entries={data?.rankings.closer ?? []}
          onOpen={handleOpen}
        />
        <RankingCard
          title="Ranking de SDRs"
          subtitle="Por agendamentos realizados"
          suffix="agend."
          roleLabel="SDR"
          entries={data?.rankings.sdr ?? []}
          onOpen={handleOpen}
        />
      </div>
      <DrilldownDialog selected={selected} onClose={() => setSelected(null)} />
    </>
  );
}
