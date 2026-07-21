"use client"

import { useParams } from "next/navigation"
import { PublicFormViewProvider } from "./features/context/PublicFormViewContext"
import { PublicFormViewContainer } from "./features/container/PublicFormViewContainer"

export default function PublicFormPage() {
  const { publicId } = useParams<{ publicId: string }>()
  return (
    <PublicFormViewProvider publicId={publicId}>
      <PublicFormViewContainer />
    </PublicFormViewProvider>
  )
}
