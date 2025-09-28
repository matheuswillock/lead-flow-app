import { ChartAreaInteractive } from "@/app/[supabaseId]/dashboard/features/container/chart-area-interactive"
import { SectionCardsWithContext } from "@/app/[supabaseId]/dashboard/features/container/section-cards-with-context"
import { DashboardProvider } from "./features/context/DashboardContext";

export default function Dashboard() {
  return (
    <DashboardProvider initialFilters={{ period: '30d' }}>
      <div className="container mx-auto p-6 space-y-6">
        {/* <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="text-sm text-gray-500">
            Visão geral das métricas e performance
          </div>
        </div> */}

        {/* Seção de Cards com Métricas usando Context */}
        <SectionCardsWithContext />

        {/* Componente com Context para demonstrar uso
        <DashboardMetricsWithContext /> */}

        {/* Gráfico Interativo */}
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive />
        </div>
      </div>
    </DashboardProvider>
  )
}
