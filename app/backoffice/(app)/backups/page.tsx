"use client"

import { BackofficeBackupsProvider } from "./features/context/BackofficeBackupsContext"
import { BackofficeBackupsContainer } from "./features/container/BackofficeBackupsContainer"
import { BackofficeBackupsService } from "./features/services/BackofficeBackupsService"

const backupsService = new BackofficeBackupsService()

export default function BackofficeBackupsPage() {
  return (
    <BackofficeBackupsProvider service={backupsService}>
      <BackofficeBackupsContainer />
    </BackofficeBackupsProvider>
  )
}
