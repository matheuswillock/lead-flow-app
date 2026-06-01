import { ContactsProvider } from './features/context/ContactsContext'
import { ContatosContainer } from './features/container/ContatosContainer'

type Props = { params: Promise<{ supabaseId: string }> }

export default async function ContatosPage({ params }: Props) {
  const { supabaseId } = await params
  return (
    <ContactsProvider supabaseId={supabaseId}>
      <div className="container mx-auto p-6 space-y-6">
        <ContatosContainer />
      </div>
    </ContactsProvider>
  )
}
