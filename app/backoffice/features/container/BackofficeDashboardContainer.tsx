"use client"

import { Users, CreditCard, CheckCircle, DollarSign } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useBackofficeDashboard } from "../context/BackofficeDashboardContext"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value)
}

export function BackofficeDashboardContainer() {
  const { totalClients, pendingPayments, confirmedPayments, totalRevenue, isLoading } =
    useBackofficeDashboard()

  const cards = [
    {
      title: "Total de Clientes",
      value: totalClients,
      icon: Users,
      description: "Clientes cadastrados",
    },
    {
      title: "Cobranças Pendentes",
      value: pendingPayments,
      icon: CreditCard,
      description: "Aguardando pagamento",
    },
    {
      title: "Cobranças Confirmadas",
      value: confirmedPayments,
      icon: CheckCircle,
      description: "Pagamentos recebidos",
    },
    {
      title: "Receita Total",
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      description: "Pagamentos confirmados",
    },
  ]

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
