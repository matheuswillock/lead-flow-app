import { PublicOfferProvider } from "./features/context/PublicOfferContext"
import { PublicOfferContainer } from "./features/container/PublicOfferContainer"

export default async function PublicOfferPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <PublicOfferProvider token={token}>
      <PublicOfferContainer />
    </PublicOfferProvider>
  )
}
