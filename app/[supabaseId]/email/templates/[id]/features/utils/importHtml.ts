'use client'

import { generateJSON } from '@tiptap/core'
import type { Editor as TiptapEditor } from '@tiptap/core'
import DOMPurify from 'dompurify'

export function sanitizeImportedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'html',
      'body',
      'table',
      'tbody',
      'thead',
      'tr',
      'td',
      'th',
      'div',
      'p',
      'a',
      'img',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'b',
      'i',
      'br',
      'hr',
      'blockquote',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'width',
      'height',
      'style',
      'align',
      'valign',
      'bgcolor',
      'border',
      'cellpadding',
      'cellspacing',
      'target',
      'rel',
      'class',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  })
}

export function applyHtmlToEditor(editor: TiptapEditor, rawHtml: string): void {
  const sanitized = sanitizeImportedHtml(rawHtml)
  const extensions = editor.extensionManager.extensions
  const json = generateJSON(sanitized, extensions)
  editor.chain().focus().setContent(json, true).run()
}

export function attachHtmlPasteListener(
  editor: TiptapEditor,
  onSuccess?: () => void,
  onError?: (error: unknown) => void
): () => void {
  const handler = (event: ClipboardEvent) => {
    if (!editor.isEmpty) return

    const html = event.clipboardData?.getData('text/html')?.trim()
    if (!html) return

    if (!/<(html|body|table|div|p|h[1-6])/i.test(html)) return

    event.preventDefault()

    try {
      applyHtmlToEditor(editor, html)
      onSuccess?.()
    } catch (error) {
      onError?.(error)
    }
  }

  editor.view.dom.addEventListener('paste', handler)

  return () => {
    editor.view.dom.removeEventListener('paste', handler)
  }
}
