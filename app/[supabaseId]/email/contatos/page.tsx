import { ContatosProvider } from './features/context/ContatosContext'
import { ContatosContainer } from './features/container/ContatosContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function ContatosPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <ContatosProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <ContatosContainer />
      </div>
    </ContatosProvider>
  )
}
