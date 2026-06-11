"use client";

import { useState } from 'react';
import { AlertCircle, GripVertical, Settings, UserPlus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useCarteiraContext } from '../context/CarteiraContext';
import {
  CARTEIRA_TABLE_COLUMN_OPTIONS,
  DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER,
  DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY,
  type CarteiraTableColumnKey,
} from '../context/CarteiraTypes';
import { CarteiraStatsRow } from '../components/CarteiraStatsRow';
import { CarteiraFiltersBar } from './CarteiraFiltersBar';
import { CarteiraRenovacoesView } from './CarteiraRenovacoesView';
import { CarteiraTable } from './CarteiraTable';
import { AddPortfolioClientDialog } from '../components/AddPortfolioClientDialog';

function SortableCarteiraColumnOption({
  option,
  isChecked,
  onCheckedChange,
}: {
  option: (typeof CARTEIRA_TABLE_COLUMN_OPTIONS)[number];
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const checkboxId = `carteira-column-${option.key}`;
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: option.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
    >
      <div className="flex items-center gap-3">
        <Checkbox
          id={checkboxId}
          checked={isChecked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
        />
        <Label htmlFor={checkboxId} className="text-sm font-medium leading-none">
          {option.label}
        </Label>
      </div>
      <button
        type="button"
        className="inline-flex size-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground"
        aria-label={`Reordenar coluna ${option.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
    </div>
  );
}

export function CarteiraContainer() {
  const {
    data,
    error,
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
  } = useCarteiraContext();
  const [isAddOpen, setIsAddOpen] = useState(false);

  const renewalCount = data?.renewals.length ?? 0;
  const sensors = useSensors(useSensor(PointerSensor));

  const orderedColumnOptions = (() => {
    const optionMap = new Map(
      CARTEIRA_TABLE_COLUMN_OPTIONS.map((option) => [option.key, option] as const)
    );
    const sorted: (typeof CARTEIRA_TABLE_COLUMN_OPTIONS)[number][] = [];
    tableColumnOrder.forEach((columnId) => {
      const option = optionMap.get(columnId);
      if (option) {
        sorted.push(option);
        optionMap.delete(columnId);
      }
    });
    optionMap.forEach((option) => sorted.push(option));
    return sorted;
  })();

  const handleColumnConfigDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOrder = orderedColumnOptions.map((option) => option.key);
    const oldIndex = currentOrder.indexOf(active.id as CarteiraTableColumnKey);
    const newIndex = currentOrder.indexOf(over.id as CarteiraTableColumnKey);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(currentOrder, oldIndex, newIndex);
    setTableColumnOrder(nextOrder);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Carteira</h1>
        <p className="text-sm text-muted-foreground">Gestão de clientes com negócio fechado</p>
      </div>

      <Tabs defaultValue="clientes">
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="renovacoes" className="gap-1.5">
              Renovações
              {renewalCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {renewalCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="m-0">
            <div className="flex items-center gap-2">
              <Button type="button" onClick={() => setIsAddOpen(true)}>
                <UserPlus data-icon="inline-start" />
                Adicionar cliente
              </Button>
              <Sheet>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SheetTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-9"
                          aria-label="Configuração das colunas da tabela"
                        >
                          <Settings className="size-4" />
                        </Button>
                      </SheetTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Configuração das colunas</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <SheetContent side="right" className="w-[420px] sm:w-[460px]">
                  <SheetHeader>
                    <SheetTitle>Configuração das colunas</SheetTitle>
                    <SheetDescription>
                      Selecione os headers visíveis na tabela da carteira e ajuste a ordem.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 grid gap-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleColumnConfigDragEnd}
                    >
                      <SortableContext
                        items={orderedColumnOptions.map((option) => option.key)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="grid gap-3">
                          {orderedColumnOptions.map((option) => (
                            <SortableCarteiraColumnOption
                              key={option.key}
                              option={option}
                              isChecked={tableColumnVisibility[option.key] !== false}
                              onCheckedChange={(nextChecked) => {
                                setTableColumnVisibility((prev) => ({
                                  ...prev,
                                  [option.key]: nextChecked,
                                }));
                              }}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Essa configuração afeta apenas sua visualização da carteira.
                  </p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTableColumnVisibility(DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY);
                        setTableColumnOrder(DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER);
                      }}
                    >
                      Restaurar padrão
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </TabsContent>
        </div>

        <TabsContent value="clientes" className="mt-5 flex flex-col gap-5">
          <CarteiraStatsRow />
          <CarteiraFiltersBar />
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CarteiraTable />
        </TabsContent>

        <TabsContent value="renovacoes" className="mt-5">
          <CarteiraRenovacoesView />
        </TabsContent>
      </Tabs>

      <AddPortfolioClientDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  );
}
