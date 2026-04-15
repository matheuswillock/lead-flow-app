import { AnalyticsProvider } from './features/context/AnalyticsContext'
import { AnalyticsContainer } from './features/container/AnalyticsContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function AnalyticsPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <AnalyticsProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <AnalyticsContainer />
      </div>
    </AnalyticsProvider>
  )
}
