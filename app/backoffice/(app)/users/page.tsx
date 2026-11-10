"use client"

import { BackofficeUsersProvider } from "./features/context/BackofficeUsersContext"
import { BackofficeUsersContainer } from "./features/container/BackofficeUsersContainer"
import { BackofficeOperatorLinksService } from "./features/services/BackofficeOperatorLinksService"
import { BackofficeUsersService } from "./features/services/BackofficeUsersService"

const usersService = new BackofficeUsersService()
const linksService = new BackofficeOperatorLinksService()

export default function BackofficeUsersPage() {
  return (
    <BackofficeUsersProvider usersService={usersService}>
      <BackofficeUsersContainer linksService={linksService} />
    </BackofficeUsersProvider>
  )
}
