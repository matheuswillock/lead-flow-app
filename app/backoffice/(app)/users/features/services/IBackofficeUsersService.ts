export interface BackofficeUserItem {
  id: string
  email: string
  fullAccess: boolean
  isActive: boolean
  isSdr: boolean
  isCloser: boolean
  mailboxStatus: string
  mailboxAddress: string | null
  createdAt: string
  profile: {
    fullName: string | null
    email: string
  }
}

export interface CreateUserFormData {
  email: string
  fullName: string
  temporaryPassword: string
  fullAccess: boolean
  isSdr?: boolean
  isCloser?: boolean
}

export interface UpdateUserFormData {
  email?: string
  fullName?: string
  isActive?: boolean
  fullAccess?: boolean
  isSdr?: boolean
  isCloser?: boolean
}

export interface CreateUserResult {
  isValid: boolean
  errorMessages: string[]
  result?: { id: string } | null
}

export interface IBackofficeUsersService {
  list(): Promise<BackofficeUserItem[]>
  create(data: CreateUserFormData): Promise<CreateUserResult>
  update(id: string, data: UpdateUserFormData): Promise<{ isValid: boolean; errorMessages: string[] }>
  delete(id: string): Promise<{ isValid: boolean; errorMessages: string[] }>
}
