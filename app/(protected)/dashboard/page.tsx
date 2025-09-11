import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { SectionCards } from "@/components/section-cards"
// import { createSupabaseServer } from "@/lib/supabase/server"


export default async function Dashboard() {
  // const supabase = await createSupabaseServer()
  // let user: any = null
  // if (supabase) {
  //   const { data } = await supabase.auth.getUser()
  //   user = data.user
  // }
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
    </div>
  )
}
