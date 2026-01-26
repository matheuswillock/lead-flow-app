'use client';

import { useDashboardContext } from '../context/DashboardContext';
import { getLeadStatusLabel } from '@/lib/lead-status';

export function DashboardMetricsWithContext() {
  const { 
    metrics, 
    detailedMetrics, 
    isLoading, 
    error, 
    filters,
    customDateRange,
    refreshMetrics,
    setPeriod,
    setCustomDateRange,
    clearCustomDateRange,
    clearError
  } = useDashboardContext();

  const handlePeriodChange = (period: '7d' | '30d' | '3m' | '6m' | '1y') => {
    setPeriod(period);
  };

  const handleCustomDateRange = () => {
    setCustomDateRange('2024-01-01', '2024-12-31');
  };

  const handleClearCustomRange = () => {
    clearCustomDateRange();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Carregando métricas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Erro ao carregar métricas
            </h3>
            <div className="mt-2 text-sm text-red-700">
              {error}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => refreshMetrics()}
                className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm hover:bg-red-200"
              >
                Tentar novamente
              </button>
              <button
                onClick={clearError}
                className="bg-gray-100 text-gray-800 px-3 py-2 rounded-md text-sm hover:bg-gray-200"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center text-gray-500 p-8">
        Nenhuma métrica encontrada
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status dos Filtros */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-800">Filtros Ativos</h3>
            <div className="mt-1 text-sm text-blue-700">
              {customDateRange ? (
                <span>
                  Período customizado: {customDateRange.startDate} até {customDateRange.endDate}
                </span>
              ) : (
                <span>Período: {filters.period || 'Não definido'}</span>
              )}
            </div>
          </div>
          {customDateRange && (
            <button
              onClick={handleClearCustomRange}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Limpar período customizado
            </button>
          )}
        </div>
      </div>

      {/* Filtros de Período */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Filtros</h3>
        <div className="flex flex-wrap gap-2">
          {(['7d', '30d', '3m', '6m', '1y'] as const).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.period === period && !customDateRange
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
              }`}
            >
              {period}
            </button>
          ))}
          <button
            onClick={handleCustomDateRange}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              customDateRange
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            2024 Completo
          </button>
          <button
            onClick={() => refreshMetrics()}
            className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full hover:bg-green-200"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Agendamentos</h3>
          <p className="text-2xl font-bold text-blue-600">{metrics.agendamentos}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Negociação</h3>
          <p className="text-2xl font-bold text-yellow-600">{metrics.negociacao}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Implementação</h3>
          <p className="text-2xl font-bold text-orange-600">{metrics.implementacao}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Vendas</h3>
          <p className="text-2xl font-bold text-green-600">{metrics.vendas}</p>
        </div>
      </div>

      {/* Métricas Calculadas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Taxa de Conversão</h3>
          <p className="text-2xl font-bold text-purple-600">{metrics.taxaConversao}%</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Receita Total</h3>
          <p className="text-2xl font-bold text-green-600">
            R$ {metrics.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Churn Rate</h3>
          <p className="text-2xl font-bold text-red-600">{metrics.churnRate}%</p>
        </div>
      </div>

      {/* Leads por Período */}
      {metrics.leadsPorPeriodo.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Leads por Período</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {metrics.leadsPorPeriodo.slice(0, 20).map((item: any, index: number) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{item.periodo}</span>
                <span className="font-medium">{item.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas Detalhadas */}
      {detailedMetrics && detailedMetrics.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Métricas Detalhadas por Status</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Médio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {detailedMetrics.map((metric: any, index: number) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {getLeadStatusLabel(metric.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {metric.averageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {metric.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
