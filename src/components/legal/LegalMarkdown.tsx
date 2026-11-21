import { renderLegalMarkdown } from '@/lib/legal-markdown'

export function LegalMarkdown({ markdown }: { markdown: string }) {
  return (
    <div
      className="legal-prose"
      dangerouslySetInnerHTML={{ __html: renderLegalMarkdown(markdown || '') }}
    />
  )
}
