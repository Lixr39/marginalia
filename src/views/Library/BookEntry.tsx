import { Link } from 'react-router-dom'
import { Folio } from '../../components/shared/Folio'

export interface BookEntryData {
  id: string
  title: string
  author: string
  cover?: string
  letter: string
  coverVariant: 1 | 2 | 3 | 4
  metaParts: string[]
  progressPct: number
  marginalia?: string
}

export function BookEntry({ data }: { data: BookEntryData }) {
  const { id, title, author, cover, letter, coverVariant, metaParts, progressPct, marginalia } = data
  return (
    <Link to={`/read/${id}`} className="book-entry">
      {cover ? (
        <img src={cover} alt={title} className="book-entry__cover-img" />
      ) : (
        <div className={`book-entry__cover book-entry__cover--c${coverVariant}`}>
          {letter}
        </div>
      )}
      <div className="book-entry__body">
        <div className="book-entry__title">{title}</div>
        <div className="book-entry__author">{author}</div>
        {metaParts.length > 0 && (
          <div className="book-entry__meta">
            {metaParts.map((p, i) => (
              <span key={i}>
                {i > 0 && <span className="book-entry__meta-em">—</span>}
                {p}
              </span>
            ))}
          </div>
        )}
        {marginalia && (
          <div className="book-entry__marginalia">"{marginalia}"</div>
        )}
      </div>
      <div className="book-entry__folio">
        <Folio value={progressPct} />
      </div>
    </Link>
  )
}
