'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

/**
 * E6 (item 14): o skeleton espelha o layout real (header, TabsList e o grid
 * `md:grid-cols-2 xl:grid-cols-4` dos cards de Resumo) para não gerar flash
 * de reorganização quando os dados chegam.
 */
export function SubscriptionSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex gap-1.5 border-b pb-0">
        <Skeleton className="h-9 w-24 rounded-t-lg" />
        <Skeleton className="h-9 w-32 rounded-t-lg" />
        <Skeleton className="h-9 w-24 rounded-t-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="md:col-span-2 xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-8 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>

        {[1, 2].map((key) => (
          <Card key={key}>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}

        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((key) => (
              <div key={key} className="flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-9 w-24" />
                </div>
                <Separator />
                <Skeleton className="h-3 w-64" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
