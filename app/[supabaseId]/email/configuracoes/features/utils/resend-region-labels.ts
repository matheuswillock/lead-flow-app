export const RESEND_REGION_LABELS: Record<string, string> = {
  "sa-east-1": "São Paulo (sa-east-1)",
  "us-east-1": "North Virginia (us-east-1)",
  "eu-west-1": "Ireland (eu-west-1)",
  "ap-northeast-1": "Tokyo (ap-northeast-1)",
}

export function formatResendRegion(region: string | null | undefined): string {
  if (!region) return "Não informada"
  return RESEND_REGION_LABELS[region] ?? region
}
