"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { BarChartComponentProps } from "../types";

const chartConfig = {
  agendamentos: {
    label: "Agendamentos",
    color: "var(--chart-1)",
  },
  comparecimentos: {
    label: "Comparecimentos",
    color: "var(--chart-2)",
  },
  noShows: {
    label: "No-shows",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function BarChartComponent({ 
  data, 
  title = "Agendamentos por Dia",
  className 
}: BarChartComponentProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  };

  const totalAgendamentos = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.agendamentos, 0);
  }, [data]);

  const totalComparecimentos = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.comparecimentos, 0);
  }, [data]);

  const noShowRate = React.useMemo(() => {
    if (totalAgendamentos === 0) return 0;
    const totalNoShows = data.reduce((acc, curr) => acc + curr.noShows, 0);
    return ((totalNoShows / totalAgendamentos) * 100).toFixed(1);
  }, [data, totalAgendamentos]);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {totalAgendamentos} agendamentos • {totalComparecimentos} comparecimentos • {noShowRate}% no-show
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDate}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[200px]"
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    });
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar 
              dataKey="agendamentos" 
              fill="var(--color-agendamentos)" 
              radius={[0, 0, 4, 4]}
            />
            <Bar 
              dataKey="comparecimentos" 
              fill="var(--color-comparecimentos)" 
              radius={[0, 0, 4, 4]}
            />
            <Bar 
              dataKey="noShows" 
              fill="var(--color-noShows)" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}