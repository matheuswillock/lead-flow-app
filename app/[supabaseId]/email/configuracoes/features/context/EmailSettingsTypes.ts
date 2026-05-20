export type EmailSettings = {
  fromName: string
  fromEmail: string
  replyTo: string | null
}

export type EmailSettingsState = {
  settings: EmailSettings | null
  loading: boolean
  saving: boolean
  fromName: string
  fromEmail: string
  replyTo: string
}
