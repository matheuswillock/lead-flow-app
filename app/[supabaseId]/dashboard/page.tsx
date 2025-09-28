import { ChartAreaInteractive } from "@/app/[supabaseId]/dashboard/features/container/chart-area-interactive"
import { SectionCards } from "@/app/[supabaseId]/dashboard/features/container/section-cards"

export default async function Dashboard() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
    </div>
  )
}
