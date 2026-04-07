"use client"

import { BackofficeUsersProvider } from "./features/context/BackofficeUsersContext"
import { BackofficeUsersContainer } from "./features/container/BackofficeUsersContainer"
import { BackofficeUsersService } from "./features/services/BackofficeUsersService"

const usersService = new BackofficeUsersService()

export default function BackofficeUsersPage() {
  return (
    <BackofficeUsersProvider usersService={usersService}>
      <BackofficeUsersContainer />
    </BackofficeUsersProvider>
  )
}
