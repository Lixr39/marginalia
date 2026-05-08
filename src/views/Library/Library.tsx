import { Masthead } from './Masthead'
import { SectionHeader } from './SectionHeader'
import { BookEntry, type BookEntryData } from './BookEntry'
import './Library.css'

const MOCK: BookEntryData[] = [
  {
    id: 'mock-1',
    title: '追忆似水年华',
    author: 'Marcel Proust',
    letter: 'P',
    coverVariant: 1,
    metaParts: ['§ VOL III', '38 NOTES', '2D'],
    progressPct: 62,
    marginalia: '过去是藏起来的，藏在它看似不在的地方。',
  },
  {
    id: 'mock-2',
    title: '百年孤独',
    author: 'Gabriel García Márquez',
    letter: 'G',
    coverVariant: 2,
    metaParts: ['§ CAP. IV', '12 NOTES', '5D'],
    progressPct: 28,
  },
  {
    id: 'mock-3',
    title: '夜雨与玫瑰',
    author: 'Rainer Maria Rilke',
    letter: 'R',
    coverVariant: 3,
    metaParts: ['JUST OPENED', 'TODAY'],
    progressPct: 8,
  },
  {
    id: 'mock-4',
    title: '瓦尔登湖',
    author: 'Henry David Thoreau',
    letter: 'T',
    coverVariant: 4,
    metaParts: ['FINAL CH.', '4 NOTES TODAY'],
    progressPct: 95,
  },
]

function formatIssueDate(d: Date): string {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function Library() {
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)

  return (
    <main className="library">
      <Masthead issueNo={dayOfYear} date={formatIssueDate(today)} />
      <SectionHeader roman="I." label="IN PROGRESS" count="FOUR VOLUMES" />
      <ul>
        {MOCK.map(b => (
          <li key={b.id}>
            <BookEntry data={b} />
          </li>
        ))}
      </ul>
    </main>
  )
}
