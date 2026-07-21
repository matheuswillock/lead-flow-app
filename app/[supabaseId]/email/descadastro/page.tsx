import { DescadastroProvider } from "./features/context/DescadastroContext"
import { DescadastroContainer } from "./features/container/DescadastroContainer"

type Props = { params: Promise<{ supabaseId: string }> }

export default async function EmailDescadastroPage({ params }: Props) {
  await params
  return (
    <DescadastroProvider>
      <div className="min-h-screen bg-[color:var(--surface-0)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 md:px-6 md:py-10">
          <DescadastroContainer />
        </div>
      </div>
    </DescadastroProvider>
  )
}
