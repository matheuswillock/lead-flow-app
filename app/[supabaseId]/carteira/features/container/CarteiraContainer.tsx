"use client";

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCarteiraContext } from '../context/CarteiraContext';
import { CarteiraFiltersBar } from './CarteiraFiltersBar';
import { CarteiraTable } from './CarteiraTable';

export function CarteiraContainer() {
  const { error } = useCarteiraContext();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Carteira</h1>
        <p className="text-sm text-muted-foreground">Gestão de clientes com negócio fechado</p>
      </div>

      <CarteiraFiltersBar />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CarteiraTable />
    </div>
  );
}
