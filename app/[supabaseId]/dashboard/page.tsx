import { ChartAreaInteractive } from "@/app/[supabaseId]/dashboard/features/container/chart-area-interactive"
import { SectionCards } from "@/app/[supabaseId]/dashboard/features/container/section-cards"
import { useDashboardMetrics } from "./features/hooks/useDashboardMetrics";
import { MetricsFilters } from "./features/services/IDashboardMetricsService";

interface DashboardMetricsProps {
  supabaseId: string;
}

export default async function Dashboard({ supabaseId }: DashboardMetricsProps) {
  const { 
    metrics, 
    detailedMetrics, 
    loading, 
    error, 
    refetch, 
    updateFilters 
  } = useDashboardMetrics(supabaseId, { period: '30d' });

  const handlePeriodChange = (period: '7d' | '30d' | '3m' | '6m' | '1y') => {
    const filters: MetricsFilters = { period };
    updateFilters(filters);
  };

  const handleCustomDateRange = () => {
    const filters: MetricsFilters = {
      startDate: '2024-01-01',
      endDate: '2024-12-31'
    };
    updateFilters(filters);
  };

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards 
        {...metrics!}
      />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive  />
      </div>
    </div>
  )
}
