import { TemplatesProvider } from './features/context/TemplatesContext'
import { TemplatesContainer } from './features/container/TemplatesContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function TemplatesPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <TemplatesProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <TemplatesContainer />
      </div>
    </TemplatesProvider>
  )
}
