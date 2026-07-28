export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export interface UploadedWhatsAppMedia {
  storagePath: string
  sha256: string
  sizeBytes: number
  mimeType: string
  fileName: string
}

export async function createMediaUploadAndPut(input: {
  teamId: string
  supabaseId: string
  conversationId: string
  clientMessageId: string
  file: File
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
}): Promise<UploadedWhatsAppMedia> {
  const mimeType = input.file.type || "application/octet-stream"
  const sha256 = await sha256Hex(input.file)
  const sizeBytes = input.file.size

  const createResponse = await fetch(
    `/api/v1/teams/${encodeURIComponent(input.teamId)}/whatsapp/media/uploads`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-supabase-user-id": input.supabaseId,
        "x-team-id": input.teamId,
      },
      body: JSON.stringify({
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
        fileName: input.file.name,
        mimeType,
        sizeBytes,
        sha256,
      }),
      signal: input.signal,
    }
  )

  const createOutput = (await createResponse.json()) as {
    isValid?: boolean
    result?: { storagePath?: string; signedUploadToken?: string }
    errorMessages?: string[]
  }
  if (!createResponse.ok || !createOutput.isValid || !createOutput.result?.signedUploadToken || !createOutput.result.storagePath) {
    throw new Error(createOutput.errorMessages?.[0] ?? "Não foi possível preparar o upload")
  }

  const { storagePath, signedUploadToken } = createOutput.result
  input.onProgress?.(0.1)

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", signedUploadToken)
    xhr.setRequestHeader("Content-Type", mimeType)
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      input.onProgress?.(0.1 + (event.loaded / event.total) * 0.9)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        input.onProgress?.(1)
        resolve()
        return
      }
      reject(new Error("Falha ao enviar o arquivo para o storage"))
    }
    xhr.onerror = () => reject(new Error("Falha de rede no upload"))
    xhr.onabort = () => reject(new DOMException("Upload cancelado", "AbortError"))
    if (input.signal) {
      if (input.signal.aborted) {
        xhr.abort()
        return
      }
      input.signal.addEventListener("abort", () => xhr.abort(), { once: true })
    }
    xhr.send(input.file)
  })

  return {
    storagePath,
    sha256,
    sizeBytes,
    mimeType,
    fileName: input.file.name,
  }
}
