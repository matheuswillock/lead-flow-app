"use client"

import { BackofficeAllUsersProvider } from "./features/context/BackofficeAllUsersContext"
import { BackofficeAllUsersContainer } from "./features/container/BackofficeAllUsersContainer"
import { BackofficeAllUsersService } from "./features/services/BackofficeAllUsersService"

const allUsersService = new BackofficeAllUsersService()

export default function BackofficeAllUsersPage() {
  return (
    <BackofficeAllUsersProvider service={allUsersService}>
      <BackofficeAllUsersContainer />
    </BackofficeAllUsersProvider>
  )
}
