export type EmailUnsubscribeInfo = {
  teamName: string
  maskedEmail: string
  alreadyUnsubscribed: boolean
  alreadyBlocked?: boolean
  campaignName?: string | null
}

export type EmailUnsubscribeScope = "campaign" | "all"

export type EmailUnsubscribeState = {
  token: string
  loading: boolean
  confirming: boolean
  info: EmailUnsubscribeInfo | null
  completed: boolean
  error: string | null
  removeFromCampaign: boolean
  removeFromAll: boolean
}
