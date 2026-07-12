import { useMemo, useState } from 'react'
import { extractSharePayloads } from '../decode/teamShare'

/**
 * Second ingestion path (SPEC §2.3): paste `#t=` links or whole Email-to-TO
 * bodies; every `#t=<payload>` found is decoded.
 */
export function PasteBox({
  onPayloads,
  busy,
}: {
  onPayloads: (payloads: string[]) => void
  busy: boolean
}) {
  const [text, setText] = useState('')
  const found = useMemo(() => extractSharePayloads(text), [text])

  return (
    <div className="paste-box">
      <textarea
        placeholder="…or paste #t= team-share links here — whole email bodies are fine, every link is picked up"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div className="paste-actions">
        <span className="paste-count">
          {text.length === 0 ? '' : found.length === 0 ? 'No #t= links found' : `${found.length} link${found.length === 1 ? '' : 's'} found`}
        </span>
        <button
          disabled={busy || found.length === 0}
          onClick={() => {
            onPayloads(found)
            setText('')
          }}
        >
          Ingest links
        </button>
      </div>
    </div>
  )
}
