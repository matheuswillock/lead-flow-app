"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { MetricCardProps } from "../types";

export function MetricCard({ 
  title, 
  metric, 
  icon: Icon, 
  className 
}: MetricCardProps) {
  const formatValue = (value: number, format = metric.format || "number") => {
    switch (format) {
      case "currency":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      case "percentage":
        return `${value.toFixed(1)}%`;
      default:
        return new Intl.NumberFormat("pt-BR").format(value);
    }
  };

  const getTrendIcon = () => {
    switch (metric.trend) {
      case "up":
        return <TrendingUp className="h-4 w-4" />;
      case "down":
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    switch (metric.trend) {
      case "up":
        return "text-green-600 dark:text-green-400";
      case "down":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getTrendText = () => {
    if (metric.trend === "stable") return "Estável";
    const direction = metric.trend === "up" ? "Crescimento" : "Redução";
    return `${direction} de ${metric.percentage.toFixed(1)}%`;
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <div className="text-2xl font-bold">
            {formatValue(metric.value)}
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={`${getTrendColor()} border-current`}>
              <span className="flex items-center gap-1">
                {getTrendIcon()}
                {getTrendText()}
              </span>
            </Badge>
          </div>
          {metric.label && (
            <p className="text-xs text-muted-foreground">
              {metric.label}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}