import { PublicAdhesionProvider } from "./features/context/PublicAdhesionContext"
import { PublicAdhesionContainer } from "./features/container/PublicAdhesionContainer"

export default async function PublicAdhesionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <PublicAdhesionProvider token={token}>
      <PublicAdhesionContainer />
    </PublicAdhesionProvider>
  )
}
