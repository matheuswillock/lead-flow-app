"use client";

import { useState } from 'react';
import { AlertCircle, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCarteiraContext } from '../context/CarteiraContext';
import { CarteiraFiltersBar } from './CarteiraFiltersBar';
import { CarteiraTable } from './CarteiraTable';
import { AddPortfolioClientDialog } from '../components/AddPortfolioClientDialog';

export function CarteiraContainer() {
  const { error } = useCarteiraContext();
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Carteira</h1>
          <p className="text-sm text-muted-foreground">Gestão de clientes com negócio fechado</p>
        </div>
        <Button type="button" onClick={() => setIsAddOpen(true)}>
          <UserPlus data-icon="inline-start" />
          Adicionar cliente
        </Button>
      </div>

      <CarteiraFiltersBar />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CarteiraTable />

      <AddPortfolioClientDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  );
}
