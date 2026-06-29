"use client";

import { useMemo, useState } from "react";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatLocalDateValue } from "@/lib/dates";
import { useTimezone } from "@/app/context/TimezoneContext";
import { useMeetingsHeldContext } from "../../context/MeetingsHeldContext";

const parseDateKey = (value: string): Date | undefined => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const toDateKey = (date: Date, tz: string) => formatLocalDateValue(date, tz);

export function MeetingsHeldCalendarPanel() {
  const { tz } = useTimezone();
  const { data, filters, setDateRange, setFilter } = useMeetingsHeldContext();
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => parseDateKey(filters.endDate) ?? new Date());

  const selectedRange = useMemo<DateRange | undefined>(() => {
    if (!filters.startDate) return undefined;
    return {
      from: parseDateKey(filters.startDate),
      to: parseDateKey(filters.endDate),
    };
  }, [filters.startDate, filters.endDate]);

  const dayCounts = data?.dayCounts ?? {};

  return (
    <Card className="w-full min-h-0 lg:h-full">
      <CardContent className="flex flex-col gap-3 py-4 px-2">
        <div className="px-2">
          <div className="text-sm font-semibold">Período</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Selecione o intervalo de datas no calendário
          </div>
        </div>
        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={(range) => {
            if (!range?.from) return;
            const startDate = toDateKey(range.from, tz);
            const endDate = range.to ? toDateKey(range.to, tz) : startDate;
            setDateRange(startDate, endDate);
            if (range.to) {
              setFilter("countMonth", endDate.slice(0, 7));
              setCalendarMonth(range.to);
            }
          }}
          month={calendarMonth}
          onMonthChange={(month) => {
            setCalendarMonth(month);
            setFilter("countMonth", toDateKey(month, tz).slice(0, 7));
          }}
          locale={ptBR}
          captionLayout="dropdown"
          showOutsideDays={false}
          weekdayLabelFormat="short"
          className="bg-transparent p-0 [--cell-size:2.25rem] sm:[--cell-size:2.5rem]"
          components={{
            DayButton: (props) => {
              const key = toDateKey(props.day.date, tz);
              const count = dayCounts[key] ?? 0;
              const isSelected = selectedRange?.from && selectedRange?.to
                ? props.day.date >= selectedRange.from && props.day.date <= selectedRange.to
                : false;
              return (
                <CalendarDayButton
                  {...props}
                  className={cn(props.className, count > 0 && "gap-0.5")}
                >
                  <span>{props.children}</span>
                  {count > 0 && (
                    <span
                      className={cn(
                        "text-[9px] font-semibold leading-none",
                        isSelected ? "text-primary-foreground/75" : "text-primary"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </CalendarDayButton>
              );
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
