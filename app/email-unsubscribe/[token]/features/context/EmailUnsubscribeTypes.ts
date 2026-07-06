export type EmailUnsubscribeInfo = {
  teamName: string
  maskedEmail: string
  alreadyUnsubscribed: boolean
}

export type EmailUnsubscribeState = {
  token: string
  loading: boolean
  confirming: boolean
  info: EmailUnsubscribeInfo | null
  completed: boolean
  error: string | null
}
