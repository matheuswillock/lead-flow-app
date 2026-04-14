import { HistoricoProvider } from './features/context/HistoricoContext'
import { HistoricoContainer } from './features/container/HistoricoContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function HistoricoPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <HistoricoProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <HistoricoContainer />
      </div>
    </HistoricoProvider>
  )
}
