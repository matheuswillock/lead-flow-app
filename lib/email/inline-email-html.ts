import juice from "juice"

/**
 * Inlines `<style>`/class-based CSS into element `style=""` attributes for
 * better email-client compatibility (notably Outlook/Word engine, which ignores
 * `<head><style>` rules). Media queries are preserved in `<style>` blocks.
 *
 * Should be applied ONCE to a template's HTML before per-recipient variable
 * interpolation — `juice` does not touch `{{token}}` placeholders. On any
 * failure the original HTML is returned so sending is never blocked.
 */
export function inlineEmailHtml(html: string): string {
  if (!html?.trim()) return html

  try {
    return juice(html, { preserveImportant: true })
  } catch (error) {
    console.error("[inlineEmailHtml] Failed to inline CSS, sending original HTML", error)
    return html
  }
}
