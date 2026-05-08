"use client";

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceContext } from '../context/PerformanceContext';

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface TopHighlightCardProps {
  title: string;
  name: string;
  role: string;
  value: number;
  suffix: string;
  attendanceRate: number;
  accentColor: string;
}

function TopHighlightCard({
  title,
  name,
  role,
  value,
  suffix,
  attendanceRate,
  accentColor,
}: TopHighlightCardProps) {
  return (
    <Card 
      className="border-l-4" 
      style={{ 
        borderLeftColor: accentColor,
        boxShadow: `inset 0 0 20px ${accentColor}15, -4px 0 12px ${accentColor}30`
      }}
    >
      <CardHeader className="pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="text-sm font-semibold">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight truncate">{name}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-sm text-muted-foreground">{suffix}</span>
          </div>
          <p className="text-xs text-muted-foreground">{attendanceRate.toFixed(1)}% taxa de presença</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceTopHighlights() {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const topCloser = data?.highlights.topCloser;
  const topSdr = data?.highlights.topSdr;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {topCloser ? (
        <TopHighlightCard
          title="Top Closer do Mês"
          name={topCloser.name}
          role={topCloser.roleLabel}
          value={topCloser.value}
          suffix={topCloser.suffix}
          attendanceRate={topCloser.attendanceRate}
          accentColor="var(--primary)"
        />
      ) : (
        <Card 
        className="border-l-4" 
        style={{ 
          borderLeftColor: 'var(--primary)',
          boxShadow: `inset 0 0 20px var(--primary)15, -4px 0 12px var(--primary)30`
        }}
      >
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sem dados de Top Closer</p>
          </CardContent>
        </Card>
      )}

      {topSdr ? (
        <TopHighlightCard
          title="Top SDR do Mês"
          name={topSdr.name}
          role={topSdr.roleLabel}
          value={topSdr.value}
          suffix={topSdr.suffix}
          attendanceRate={topSdr.attendanceRate}
          accentColor="var(--semantic-info)"
        />
      ) : (
        <Card 
        className="border-l-4" 
        style={{ 
          borderLeftColor: 'var(--semantic-info)',
          boxShadow: `inset 0 0 20px var(--semantic-info)15, -4px 0 12px var(--semantic-info)30`
        }}
      >
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sem dados de Top SDR</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
