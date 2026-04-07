"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import type {
  IBackofficeUsersService,
  BackofficeUserItem,
  CreateUserFormData,
  UpdateUserFormData,
} from "../services/IBackofficeUsersService"
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext"

interface UsersContextValue {
  users: BackofficeUserItem[]
  isLoading: boolean
  isCreating: boolean
  canManageUsers: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  createUser: (data: CreateUserFormData) => Promise<{ isValid: boolean; errorMessages: string[] }>
  updateUser: (id: string, data: UpdateUserFormData) => Promise<{ isValid: boolean; errorMessages: string[] }>
}

const BackofficeUsersContext = createContext<UsersContextValue | undefined>(undefined)

interface Props {
  children: ReactNode
  usersService: IBackofficeUsersService
}

export function BackofficeUsersProvider({ children, usersService }: Props) {
  const { user } = useBackofficeUser()
  const [users, setUsers] = useState<BackofficeUserItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  const canManageUsers = user?.fullAccess === true

  const fetchUsers = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setIsLoading(true)
    setError(null)
    try {
      const data = await usersService.list()
      setUsers(data)
    } catch (err) {
      console.error("[BackofficeUsersContext]", err)
      setError("Erro ao carregar usuários")
    } finally {
      setIsLoading(false)
      inFlight.current = false
    }
  }, [usersService])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const createUser = useCallback(
    async (data: CreateUserFormData) => {
      setIsCreating(true)
      try {
        const result = await usersService.create(data)
        if (result.isValid) {
          await fetchUsers()
        }
        return result
      } finally {
        setIsCreating(false)
      }
    },
    [usersService, fetchUsers]
  )

  const updateUser = useCallback(
    async (id: string, data: UpdateUserFormData) => {
      const result = await usersService.update(id, data)
      if (result.isValid) {
        await fetchUsers()
      }
      return result
    },
    [usersService, fetchUsers]
  )

  return (
    <BackofficeUsersContext.Provider
      value={{ users, isLoading, isCreating, canManageUsers, error, fetchUsers, createUser, updateUser }}
    >
      {children}
    </BackofficeUsersContext.Provider>
  )
}

export function useBackofficeUsers(): UsersContextValue {
  const ctx = useContext(BackofficeUsersContext)
  if (!ctx) throw new Error("useBackofficeUsers must be used within BackofficeUsersProvider")
  return ctx
}
