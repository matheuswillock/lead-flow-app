'use client';

import { DashboardProvider } from "./features/context/DashboardContext";
import { useDashboardContext } from "./features/context/DashboardContext";
import { DashboardSkeleton } from "./features/components/DashboardSkeleton";
import { SectionCardsWithContext } from "./features/container/section-cards-with-context";
import { ChartAreaInteractive } from "./features/container/chart-area-interactive";

function DashboardContent() {
  const { isLoading, error, metrics } = useDashboardContext();

  // Se está carregando e não tem dados ainda, mostra skeleton completo
  if (isLoading && !metrics) {
    return <DashboardSkeleton />;
  }

  // Se há erro global
  if (error && !metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="text-red-600 text-lg font-medium">
              Erro ao carregar dashboard
            </div>
            <div className="text-gray-600">
              {error}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderiza o dashboard normal
  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* Seção de Cards com Métricas */}
      <SectionCardsWithContext />

      {/* Gráfico Interativo */}
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <DashboardProvider initialFilters={{ period: '30d' }}>
      <DashboardContent />
    </DashboardProvider>
  )
}
