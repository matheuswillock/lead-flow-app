import { CampanhasProvider } from './features/context/CampanhasContext'
import { CampanhasContainer } from './features/container/CampanhasContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function CampanhasPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <CampanhasProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <CampanhasContainer />
      </div>
    </CampanhasProvider>
  )
}
