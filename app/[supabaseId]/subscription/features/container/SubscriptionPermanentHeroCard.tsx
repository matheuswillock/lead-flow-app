'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Sparkles } from 'lucide-react';
import type { SubscriptionData } from '../types/subscription.types';

interface SubscriptionPermanentHeroCardProps {
  subscription: SubscriptionData;
  onOpenDetails: () => void;
}

export function SubscriptionPermanentHeroCard({ subscription, onOpenDetails }: SubscriptionPermanentHeroCardProps) {
  return (
    <Card className="md:col-span-2 xl:col-span-2 border-primary/30 bg-surface-1">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge className="w-fit">
            <Sparkles data-icon="inline-start" />
            Vitalícia
          </Badge>
          <div className="flex flex-col gap-1">
            <CardTitle>{subscription.description}</CardTitle>
            <CardDescription>{subscription.customer.name} possui acesso permanente sem cobrança mensal.</CardDescription>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenDetails}>
          <FileText data-icon="inline-start" />
          Detalhes
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Benefícios ilimitados vinculados ao master da conta.</p>
      </CardContent>
    </Card>
  );
}
