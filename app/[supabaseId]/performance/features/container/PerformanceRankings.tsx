"use client";

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePerformanceContext } from '../context/PerformanceContext';
import type { PerformanceRankingEntry } from '../context/PerformanceTypes';

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function RankingTable({ title, entries }: { title: string; entries: PerformanceRankingEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem dados</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, idx) => (
              <TableRow key={entry.profileId}>
                <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                <TableCell className="font-medium">{entry.name || '—'}</TableCell>
                <TableCell className="text-right">{entry.count}</TableCell>
                <TableCell className="text-right">{formatBRL(entry.totalSalesValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function PerformanceRankings() {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <RankingTable title="Ranking SDR" entries={data?.sdrRanking ?? []} />
      <RankingTable title="Ranking Closer" entries={data?.closerRanking ?? []} />
    </div>
  );
}
