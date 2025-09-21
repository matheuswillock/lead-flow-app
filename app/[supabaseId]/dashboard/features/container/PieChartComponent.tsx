"use client";

import * as React from "react";
import { Pie, PieChart, Cell } from "recharts";
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
import { PieChartComponentProps } from "../types";

const chartConfig = {
  NEW: {
    label: "Novo",
    color: "var(--chart-1)",
  },
  QUALIFIED: {
    label: "Qualificado", 
    color: "var(--chart-2)",
  },
  PROPOSAL: {
    label: "Proposta",
    color: "var(--chart-3)",
  },
  NEGOTIATION: {
    label: "Negociação",
    color: "var(--chart-4)",
  },
  CLOSED_WON: {
    label: "Fechado",
    color: "var(--chart-5)",
  },
  CLOSED_LOST: {
    label: "Perdido",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function PieChartComponent({ 
  data, 
  title = "Distribuição de Leads por Status",
  className 
}: PieChartComponentProps) {
  const total = React.useMemo(() => {
    return data.reduce((acc, curr) => acc + curr.value, 0);
  }, [data]);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Total de {total} leads no pipeline
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[300px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent 
                  hideLabel 
                  formatter={(value, name) => [
                    `${value} leads (${((value as number / total) * 100).toFixed(1)}%)`,
                    chartConfig[name as keyof typeof chartConfig]?.label || name
                  ]}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="status"
              innerRadius={60}
              strokeWidth={5}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="status" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}