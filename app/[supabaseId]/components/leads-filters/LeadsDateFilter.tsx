"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface LeadsDateFilterProps {
  title: string;
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

export function LeadsDateFilter({ title, value, onChange }: LeadsDateFilterProps) {
  const handleClear = () => {
    onChange(undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 border-dashed",
            (value?.from || value?.to) && "border-primary"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {title}
          {value?.from && value?.to && (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              {format(value.from, "dd/MM", { locale: ptBR })} -{" "}
              {format(value.to, "dd/MM", { locale: ptBR })}
            </span>
          )}
          {value?.from && !value?.to && (
            <span className="ml-2 rounded-sm bg-primary/10 px-1 font-mono text-xs">
              A partir de {format(value.from, "dd/MM", { locale: ptBR })}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          locale={ptBR}
          numberOfMonths={2}
          disabled={(date) => date > new Date()}
        />
        {(value?.from || value?.to) && (
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={handleClear}>
              Limpar filtro
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
