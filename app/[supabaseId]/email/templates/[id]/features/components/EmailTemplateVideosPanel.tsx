"use client"

import { useCallback, useState } from "react"
import { Copy, Video } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  buildYouTubeEmailSnippet,
  buildYouTubeThumbnailUrl,
  parseYouTubeVideoId,
} from "@/lib/email/youtube-embed"

export function EmailTemplateVideosPanel({ embedded = false }: { embedded?: boolean }) {
  const [url, setUrl] = useState("")
  const [videoId, setVideoId] = useState<string | null>(null)
  const [snippet, setSnippet] = useState<string | null>(null)

  const handleGeneratePreview = useCallback(() => {
    const parsedId = parseYouTubeVideoId(url)
    if (!parsedId) {
      toast.error("URL do YouTube inválida")
      setVideoId(null)
      setSnippet(null)
      return
    }

    setVideoId(parsedId)
    setSnippet(buildYouTubeEmailSnippet({ videoId: parsedId }))
  }, [url])

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado`)
    } catch {
      toast.error("Não foi possível copiar")
    }
  }, [])

  return (
    <div className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-4 p-4"}>
      <div>
        <h3 className="text-sm font-semibold">Vídeos do YouTube</h3>
        <p className="text-xs text-muted-foreground">
          Cole a URL do vídeo para gerar um embed compatível com e-mail (thumbnail linkada).
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="youtube-url">URL do YouTube</FieldLabel>
          <Input
            id="youtube-url"
            type="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleGeneratePreview()
              }
            }}
          />
        </Field>
        <Button type="button" variant="outline" onClick={handleGeneratePreview}>
          Gerar preview
        </Button>
      </FieldGroup>

      {videoId && snippet ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <img
            src={buildYouTubeThumbnailUrl(videoId)}
            alt="Thumbnail do vídeo do YouTube"
            width={560}
            height={315}
            className="w-full rounded-md border object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 self-start px-2 text-xs"
            onClick={() => void copyToClipboard(snippet, "HTML")}
          >
            <Copy data-icon="inline-start" />
            Copiar HTML
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
          <Video className="size-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Cole uma URL do YouTube para gerar o embed.</p>
        </div>
      )}
    </div>
  )
}
