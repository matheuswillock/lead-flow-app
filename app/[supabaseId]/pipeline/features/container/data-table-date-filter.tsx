'use client';

import * as React from 'react';
import { Column } from '@tanstack/react-table';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DataTableDateFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
}

export function DataTableDateFilter<TData, TValue>({
  column,
  title,
}: DataTableDateFilterProps<TData, TValue>) {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);

    if (!range) {
      column?.setFilterValue(undefined);
      return;
    }

    // Se ambas as datas estiverem definidas, aplicar filtro
    if (range.from && range.to) {
      column?.setFilterValue([range.from, range.to]);
    } else if (range.from) {
      // Se só tiver data inicial, filtrar a partir dela
      column?.setFilterValue([range.from, undefined]);
    }
  };

  const clearFilter = () => {
    setDateRange(undefined);
    column?.setFilterValue(undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 border-dashed',
            (dateRange?.from || dateRange?.to) && 'border-primary'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {title}
          {dateRange?.from && dateRange?.to && (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              {format(dateRange.from, 'dd/MM', { locale: ptBR })} - {format(dateRange.to, 'dd/MM', { locale: ptBR })}
            </span>
          )}
          {dateRange?.from && !dateRange?.to && (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              A partir de {format(dateRange.from, 'dd/MM', { locale: ptBR })}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={dateRange}
          onSelect={handleDateSelect}
          locale={ptBR}
          numberOfMonths={2}
          disabled={(date) => date > new Date()}
        />
        {(dateRange?.from || dateRange?.to) && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={clearFilter}
            >
              Limpar filtro
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
