import { useRef, useState, type DragEvent } from 'react'

export function DropZone({ onFiles, busy }: { onFiles: (files: File[]) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!busy) onFiles([...e.dataTransfer.files])
  }

  return (
    <div
      className={`dropzone${dragOver ? ' drag-over' : ''}${busy ? ' busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click()
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles([...e.target.files])
          e.target.value = ''
        }}
      />
      <strong>Drop staff-sheet PDFs here</strong>
      <span>or click to select — you can add more at any time</span>
    </div>
  )
}
