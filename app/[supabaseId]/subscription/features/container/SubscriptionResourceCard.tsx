'use client';

import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SubscriptionResourceCardProps {
  icon: LucideIcon;
  label: string;
  used: number;
  total: number | null;
  available: number;
  removable: number;
  helperText?: string;
  isPermanent?: boolean;
}

export function SubscriptionResourceCard({
  icon: Icon,
  label,
  used,
  total,
  available,
  removable,
  helperText,
  isPermanent = false,
}: SubscriptionResourceCardProps) {
  const percent = total && total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const indicatorClassName = cn(
    '[&>div]:bg-primary',
    percent >= 80 && '[&>div]:bg-semantic-warning',
    percent >= 100 && '[&>div]:bg-semantic-danger'
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <CardTitle className="text-base">{label}</CardTitle>
        </div>
        {isPermanent ? <Badge variant="secondary">Ilimitado</Badge> : <Badge variant="outline">{percent}%</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold">{used}</span>
          <span className="pb-1 text-xl text-muted-foreground">/ {isPermanent ? '∞' : total}</span>
        </div>
        <CardDescription>{isPermanent ? 'Ilimitado para criar' : `${available} disponíveis para criar`}</CardDescription>
        {!isPermanent && <Progress value={percent} className={indicatorClassName} />}
        {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        {!isPermanent && <p className="text-xs text-muted-foreground">{removable} créditos removíveis</p>}
      </CardContent>
    </Card>
  );
}
