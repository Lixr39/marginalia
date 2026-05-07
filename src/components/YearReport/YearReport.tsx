import { useEffect, useState } from 'react'
import { getAllBooks, getReadingTimeLog, getLLMConfig, getRecoHistory, saveReco } from '../../store'
import type { StoredBook, BookReco } from '../../store'
import { chatCompletion } from '../../services/llm'
import './YearReport.css'

interface Props {
  onBack: () => void
  theme?: 'dark' | 'light'
}

interface BookRow {
  title: string
  author: string
  cover: string
  rating?: number
  highlights: number
  messages: number
  opinions: number
  agreeCount: number
  disagreeCount: number
}

interface ReportData {
  year: number
  totalBooks: number
  totalHighlights: number
  totalMessages: number
  totalOpinions: number
  totalBookmarks: number
  totalReadingSeconds: number
  avgRating: number | null
  agreeCount: number
  disagreeCount: number
  books: BookRow[]
  // Monthly breakdown (index 0=Jan)
  monthlyHighlights: number[]
  monthlyMessages: number[]
  monthlyReadingMinutes: number[]
  // Daily reading for last 30 days
  dailyReadingMinutes: Array<{ date: string; minutes: number }>
}

function fmtTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}分钟`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem > 0 ? `${h}小时${rem}分钟` : `${h}小时`
}

function computeReport(books: StoredBook[], timeLog: Record<string, number>, year: number): ReportData {
  const yearStart = new Date(year, 0, 1).getTime()
  const yearEnd = new Date(year + 1, 0, 1).getTime()
  const inYear = (ts: number) => ts >= yearStart && ts < yearEnd

  const monthlyHighlights = Array(12).fill(0)
  const monthlyMessages = Array(12).fill(0)

  let totalHighlights = 0, totalMessages = 0, totalOpinions = 0, totalBookmarks = 0
  let agreeCount = 0, disagreeCount = 0
  let ratingSum = 0, ratingCount = 0
  const bookRows: BookRow[] = []

  const activeBooks = books.filter(b => {
    const s = b.bookState
    return [
      ...(s.highlights || []).map(h => h.timestamp),
      ...(s.messages || []).map(m => m.timestamp),
      b.lastOpened,
    ].some(inYear)
  })

  for (const b of activeBooks) {
    const s = b.bookState
    const hl = (s.highlights || []).filter(h => inYear(h.timestamp))
    const msgs = (s.messages || []).filter(m => inYear(m.timestamp))
    const ops = (s.opinionCards || []).filter(c => inYear(c.timestamp))
    const bms = (s.bookmarks || []).filter(bm => inYear(bm.timestamp)).length

    hl.forEach(h => { monthlyHighlights[new Date(h.timestamp).getMonth()]++ })
    msgs.forEach(m => { monthlyMessages[new Date(m.timestamp).getMonth()]++ })

    const agree = ops.filter(c => c.userStance === 'agree').length
    const disagree = ops.filter(c => c.userStance === 'disagree').length

    totalHighlights += hl.length
    totalMessages += msgs.length
    totalOpinions += ops.length
    totalBookmarks += bms
    agreeCount += agree
    disagreeCount += disagree

    if (s.rating?.stars) { ratingSum += s.rating.stars; ratingCount++ }

    bookRows.push({
      title: b.title, author: b.author, cover: b.cover,
      rating: s.rating?.stars,
      highlights: hl.length, messages: msgs.length, opinions: ops.length,
      agreeCount: agree, disagreeCount: disagree,
    })
  }

  // Reading time
  const monthlyReadingMinutes = Array(12).fill(0)
  let totalReadingSeconds = 0
  for (const [dateStr, secs] of Object.entries(timeLog)) {
    const d = new Date(dateStr)
    if (d.getFullYear() === year) {
      monthlyReadingMinutes[d.getMonth()] += Math.round(secs / 60)
      totalReadingSeconds += secs
    }
  }

  // Daily last 30 days
  const dailyReadingMinutes: Array<{ date: string; minutes: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyReadingMinutes.push({ date: key, minutes: Math.round((timeLog[key] || 0) / 60) })
  }

  return {
    year, totalBooks: activeBooks.length,
    totalHighlights, totalMessages, totalOpinions, totalBookmarks,
    totalReadingSeconds, avgRating: ratingCount > 0 ? Math.round(ratingSum / ratingCount * 10) / 10 : null,
    agreeCount, disagreeCount,
    books: bookRows.sort((a, b) => b.highlights + b.messages - (a.highlights + a.messages)),
    monthlyHighlights, monthlyMessages, monthlyReadingMinutes,
    dailyReadingMinutes,
  }
}

// ── SVG Bar Chart ──────────────────────────────────────────────
function BarChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data, 1)
  const W = 480, H = 100, barW = Math.floor(W / 12) - 4, gap = 4
  const months = ['1','2','3','4','5','6','7','8','9','10','11','12']
  return (
    <div className="yr-chart-wrap">
      <div className="yr-chart-label">{label}</div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="yr-chart-svg">
        {data.map((v, i) => {
          const bh = Math.max(2, (v / max) * H)
          const x = i * (barW + gap) + gap
          const y = H - bh
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} rx={3} fill={color} opacity={v === 0 ? 0.15 : 0.8} />
              {v > 0 && <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fill={color} opacity={0.9}>{v}</text>}
              <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">{months[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── SVG Line Chart (daily 30 days) ─────────────────────────────
function LineChart({ data }: { data: Array<{ date: string; minutes: number }> }) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  const W = 480, H = 80
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.minutes / max) * H
    return { x, y, ...d }
  })
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${W},${H} L0,${H} Z`

  // Show label every 5 days
  const labelIdxs = [0, 6, 13, 20, 27, 29]

  return (
    <div className="yr-chart-wrap">
      <div className="yr-chart-label">近30天每日阅读时长（分钟）</div>
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="yr-chart-svg">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b89aff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#b89aff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="#b89aff" strokeWidth={2} strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.minutes > 0 ? 3 : 1.5}
            fill={p.minutes > 0 ? '#b89aff' : 'rgba(255,255,255,0.15)'} />
        ))}
        {labelIdxs.map(i => (
          <text key={i} x={pts[i].x} y={H + 14} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.3)">
            {data[i].date.slice(5)}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default function YearReport({ onBack, theme = 'dark' }: Props) {
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const currentYear = new Date().getFullYear()

  // Book recommendations
  const [recoHistory, setRecoHistory] = useState<BookReco[]>(() => getRecoHistory())
  const [recoLoading, setRecoLoading] = useState(false)
  const [recoError, setRecoError] = useState('')

  async function handleReco() {
    const config = getLLMConfig()
    if (!config?.apiKey) { setRecoError('请先配置 API Key'); return }
    setRecoLoading(true)
    setRecoError('')
    try {
      const history = getRecoHistory()
      const allBooks = await getAllBooks()
      const readTitles = allBooks.map(b => b.title).join('、') || '暂无'
      const prevRecos = history.flatMap(h => h.books.map(b => `《${b.title}》`)).join('、') || '无'

      const prompt = `用户已读书目：${readTitles}。
之前已推荐过的书（不要重复推荐）：${prevRecos}。
请根据用户的阅读偏好，推荐3本新书。要求：
1. 不得推荐已读书目和已推荐过的书
2. 每本书给出书名、作者、一句话推荐理由（30字以内，说明为什么适合这位读者）
3. 严格按以下JSON格式返回，不要有任何其他文字：
[{"title":"书名","author":"作者","reason":"推荐理由"},{"title":"书名","author":"作者","reason":"推荐理由"},{"title":"书名","author":"作者","reason":"推荐理由"}]`

      const raw = await chatCompletion(config, [
        { role: 'system', content: '你是一位博学的书单推荐助手，熟悉中外文学、社科、哲学等各类书籍。' },
        { role: 'user', content: prompt },
      ])

      // Parse JSON from response
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('格式解析失败')
      const books = JSON.parse(match[0]) as Array<{ title: string; author: string; reason: string }>
      if (!Array.isArray(books) || books.length === 0) throw new Error('推荐结果为空')

      const reco: BookReco = {
        date: new Date().toISOString().slice(0, 10),
        books,
      }
      saveReco(reco)
      setRecoHistory(getRecoHistory())
    } catch (e) {
      setRecoError(e instanceof Error ? e.message : '推荐失败，请重试')
    } finally {
      setRecoLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    getAllBooks().then(books => {
      const timeLog = getReadingTimeLog()
      setReport(computeReport(books, timeLog, year))
      setLoading(false)
    })
  }, [year])

  return (
    <div className={`yr-page ${theme}`}>
      <div className="yr-page-header">
        <button className="yr-back-btn" onClick={onBack}>← 返回</button>
        <div className="yr-page-title">阅读统计</div>
        <div className="yr-year-nav">
          <button onClick={() => setYear(y => y - 1)}>‹</button>
          <span>{year}</span>
          <button onClick={() => setYear(y => y + 1)} disabled={year >= currentYear}>›</button>
        </div>
      </div>

      <div className="yr-page-body">
        {loading ? (
          <div className="yr-loading">统计中...</div>
        ) : !report || report.totalBooks === 0 ? (
          <div className="yr-empty">
            <div className="yr-empty-icon">📚</div>
            <p>{year} 年还没有阅读记录</p>
          </div>
        ) : (
          <>
            {/* Big numbers */}
            <div className="yr-stats-grid">
              <div className="yr-stat-card">
                <div className="yr-stat-num">{report.totalBooks}</div>
                <div className="yr-stat-label">本书</div>
              </div>
              <div className="yr-stat-card">
                <div className="yr-stat-num">{report.totalHighlights}</div>
                <div className="yr-stat-label">条高亮</div>
              </div>
              <div className="yr-stat-card">
                <div className="yr-stat-num">{report.totalMessages}</div>
                <div className="yr-stat-label">条对话</div>
              </div>
              <div className="yr-stat-card">
                <div className="yr-stat-num">{report.totalOpinions}</div>
                <div className="yr-stat-label">个观点</div>
              </div>
              <div className="yr-stat-card">
                <div className="yr-stat-num">{report.totalBookmarks}</div>
                <div className="yr-stat-label">个书签</div>
              </div>
              <div className="yr-stat-card highlight">
                <div className="yr-stat-num">{fmtTime(report.totalReadingSeconds)}</div>
                <div className="yr-stat-label">累计阅读时长</div>
              </div>
            </div>

            {/* Charts */}
            <div className="yr-charts-row">
              <BarChart data={report.monthlyHighlights} color="#f0a060" label="每月高亮数" />
              <BarChart data={report.monthlyMessages} color="#6c9fff" label="每月对话数" />
            </div>
            <BarChart data={report.monthlyReadingMinutes} color="#b89aff" label="每月阅读时长（分钟）" />
            <LineChart data={report.dailyReadingMinutes} />

            {/* Insights */}
            <div className="yr-section">
              <div className="yr-section-title">✦ 阅读洞察</div>
              <div className="yr-insights">
                {report.books[0] && (
                  <div className="yr-insight-item">
                    <span className="yr-insight-icon">🖊</span>
                    <span>批注最多的书是<strong>《{report.books[0].title}》</strong>，共 {report.books[0].highlights} 条高亮</span>
                  </div>
                )}
                {report.books.reduce((a, b) => b.messages > a.messages ? b : a, report.books[0]) && (() => {
                  const top = report.books.reduce((a, b) => b.messages > a.messages ? b : a)
                  return top.messages > 0 ? (
                    <div className="yr-insight-item">
                      <span className="yr-insight-icon">💬</span>
                      <span>聊得最多的书是<strong>《{top.title}》</strong>，共 {top.messages} 条对话</span>
                    </div>
                  ) : null
                })()}
                {report.avgRating !== null && (
                  <div className="yr-insight-item">
                    <span className="yr-insight-icon">⭐</span>
                    <span>你的平均评分是 <strong>{report.avgRating} 分</strong></span>
                  </div>
                )}
                {(report.agreeCount + report.disagreeCount) > 0 && (
                  <div className="yr-insight-item">
                    <span className="yr-insight-icon">🤝</span>
                    <span>
                      面对角色观点，你赞同了 <strong>{report.agreeCount}</strong> 次，反对了 <strong>{report.disagreeCount}</strong> 次
                      {report.agreeCount > report.disagreeCount ? '——你是个包容的读者' : report.disagreeCount > report.agreeCount ? '——你有自己的主见' : '——你很平衡'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Book list */}
            <div className="yr-section">
              <div className="yr-section-title">✦ 读过的书</div>
              <div className="yr-book-list">
                {report.books.map((b, i) => (
                  <div key={i} className="yr-book-row">
                    <div className="yr-book-cover">
                      {b.cover ? <img src={b.cover} alt={b.title} /> : <div className="yr-book-cover-placeholder">📖</div>}
                    </div>
                    <div className="yr-book-info">
                      <div className="yr-book-title">《{b.title}》</div>
                      <div className="yr-book-author">{b.author}</div>
                      <div className="yr-book-stats">
                        {b.highlights > 0 && <span>{b.highlights} 条高亮</span>}
                        {b.messages > 0 && <span>{b.messages} 条对话</span>}
                        {b.opinions > 0 && <span>{b.opinions} 个观点</span>}
                        {b.rating && <span>{'★'.repeat(Math.round(b.rating))} {b.rating}分</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="yr-footer">
              <div className="yr-footer-text">— 玛珈莉亚 · Marginalia —</div>
              <div className="yr-footer-sub">每一条批注，都是你与书的对话</div>
            </div>
          </>
        )}

        {/* Book recommendations — always visible */}
        <div className="yr-section yr-reco-section">
          <div className="yr-section-title">✦ AI 书单推荐</div>
          <button
            className="yr-reco-btn"
            onClick={handleReco}
            disabled={recoLoading}
          >
            {recoLoading ? '推荐中...' : '帮我推荐书单'}
          </button>
          {recoError && <div className="yr-reco-error">{recoError}</div>}

          {recoHistory.length > 0 && (
            <div className="yr-reco-history">
              {recoHistory.map((reco, ri) => (
                <div key={ri} className="yr-reco-group">
                  <div className="yr-reco-date">{reco.date}</div>
                  <div className="yr-reco-cards">
                    {reco.books.map((b, bi) => (
                      <div key={bi} className="yr-reco-card">
                        <div className="yr-reco-card-title">《{b.title}》</div>
                        <div className="yr-reco-card-author">{b.author}</div>
                        <div className="yr-reco-card-reason">{b.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}