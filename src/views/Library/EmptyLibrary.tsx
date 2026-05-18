import { useRef } from 'react'

interface Props {
  onFile: (file: File) => void
}

export function EmptyLibrary({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="empty-library">
      <div className="empty-library__quote">
        "Lock up your libraries if you like;<br />
        but there is no gate, no lock, no bolt<br />
        that you can set upon the freedom of my mind."
      </div>
      <div className="empty-library__cite">— VIRGINIA WOOLF · A ROOM OF ONE'S OWN</div>
      <button
        className="empty-library__import"
        onClick={() => inputRef.current?.click()}
      >
        <em>+</em> IMPORT EPUB
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".epub,application/epub+zip"
        className="empty-library__hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
