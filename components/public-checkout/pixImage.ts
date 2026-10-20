const DATA_URI_PREFIX = "data:"

export function toPixImageSrc(encodedImage: string | null | undefined): string | null {
  const value = encodedImage?.trim()
  if (!value) return null
  return value.startsWith(DATA_URI_PREFIX) ? value : `data:image/png;base64,${value}`
}
