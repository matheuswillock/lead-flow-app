"use client"
import { PublicFormsProvider } from "./features/context/PublicFormsContext"
import { PublicFormsContainer } from "./features/container/PublicFormsContainer"
export default function FormsPage() {
  return (
    <PublicFormsProvider>
      <PublicFormsContainer />
    </PublicFormsProvider>
  )
}
