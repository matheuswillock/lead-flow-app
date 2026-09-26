"use client"

import { PublicFormsProvider } from "../../forms/features/context/PublicFormsContext"
import { LandingPageWizardContext } from "./features/context/LandingPageWizardContext"
import { LandingPageWizardContainer } from "./features/container/LandingPageWizardContainer"

export default function NewLandingPage() {
  return (
    <PublicFormsProvider>
      <LandingPageWizardContext>
        <LandingPageWizardContainer />
      </LandingPageWizardContext>
    </PublicFormsProvider>
  )
}
