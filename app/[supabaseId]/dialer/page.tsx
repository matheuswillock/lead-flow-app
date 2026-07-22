import { DialerProvider } from './features/context/DialerContext'
import { DialerContainer } from './features/container/DialerContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function DialerPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <DialerProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6">
        <DialerContainer />
      </div>
    </DialerProvider>
  )
}
