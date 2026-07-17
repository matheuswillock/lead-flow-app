export type BackofficeEmailUnsubscribeInfo = {
  maskedEmail: string
  alreadyUnsubscribed: boolean
}

export type BackofficeEmailUnsubscribeState = {
  token: string
  loading: boolean
  confirming: boolean
  info: BackofficeEmailUnsubscribeInfo | null
  completed: boolean
  error: string | null
}
