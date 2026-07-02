import { PublicContractProvider } from "./features/context/PublicContractContext"
import { PublicContractContainer } from "./features/container/PublicContractContainer"

export default async function PublicContractPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <PublicContractProvider token={token}>
      <PublicContractContainer />
    </PublicContractProvider>
  )
}
