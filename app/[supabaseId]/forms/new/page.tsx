import { PublicFormsNewProvider } from "./features/context/PublicFormsNewContext"
import { PublicFormsNewContainer } from "./features/container/PublicFormsNewContainer"

export default function NewFormPage() {
  return (
    <PublicFormsNewProvider>
      <PublicFormsNewContainer />
    </PublicFormsNewProvider>
  )
}
