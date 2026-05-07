import { useState } from 'react'
import type { Character, CharacterReview as CharacterReviewType } from '../../types'
import { PRESET_CHARACTERS } from '../../characters/presets'
import { getCustomCharacters, getLLMConfig } from '../../store'
import { chatCompletion } from '../../services/llm'
import './CharacterReview.css'

interface Props {
  bookTitle: string
  bookAuthor: string
  bookSummary?: string
  existingReviews: Record<string, CharacterReviewType>
  onReviewSaved: (review: CharacterReviewType) => void
  onClose: () => void
  theme?: 'dark' | 'light'
}

function getAllCharacters(): Character[] {
  return [...PRESET_CHARACTERS, ...getCustomCharacters()]
}

function renderStars(stars: number) {
  const full = Math.floor(stars)
  const half = stars % 1 >= 0.5
  return (
    <span className="cr-stars">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`cr-star ${i <= full ? 'full' : (half && i === full + 1) ? 'half' : 'empty'}`}>★</span>
      ))}
      <span className="cr-star-val">{stars}</span>
    </span>
  )
}

export default function CharacterReview({ bookTitle, bookAuthor, bookSummary, existingReviews, onReviewSaved, onClose, theme }: Props) {
  const [selectedChar, setSelectedChar] = useState<Character | null>(null)
  const [generating, setGenerating] = useState(false)
  const themeClass = theme === 'light' ? ' light' : ''

  async function handleGenerate(char: Character) {
    const config = getLLMConfig()
    if (!config) { alert('请先配置 API'); return }
    setSelectedChar(char)
    setGenerating(true)
    try {
      const systemPrompt = `你是${char.name}（${char.label}）。${char.systemPrompt.slice(0, 300)}`
      const userPrompt = `请你以自己的性格和三观，对《${bookTitle}》${bookAuthor ? `（${bookAuthor}）` : ''}写一段书评。
${bookSummary ? `\n书的大致内容：${bookSummary}\n` : ''}
要求：
- 先给出你的评分，格式：【评分：X星】（X可以是0.5到5之间，支持0.5步长，比如2.5、3.5）
- 然后写2-3句话的短评，要非常符合你的性格和立场，犀利、有观点、口语化
- 不要客观中立，就是你自己的感受和判断
- 只输出评分行和短评，不要其他内容`

      const raw = await chatCompletion(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      // 解析评分
      const starsMatch = raw.match(/【评分[：:]\s*([\d.]+)\s*星】/)
      const stars = starsMatch ? Math.min(5, Math.max(0.5, parseFloat(starsMatch[1]))) : 3
      const review = raw.replace(/【评分[：:][^】]*】/, '').trim()

      const result: CharacterReviewType = {
        characterId: char.id,
        characterName: char.name,
        stars,
        review,
        timestamp: Date.now(),
      }
      onReviewSaved(result)
    } catch (err) {
      alert('生成失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setGenerating(false)
      setSelectedChar(null)
    }
  }

  const allChars = getAllCharacters()

  return (
    <div className={`cr-overlay`} onClick={onClose}>
      <div className={`cr-panel${themeClass}`} onClick={e => e.stopPropagation()}>
        <div className="cr-header">
          <div className="cr-header-title">
            <span>角色书评</span>
            <span className="cr-book-name">《{bookTitle}》</span>
          </div>
          <button className="cr-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="cr-body">
          {allChars.map(char => {
            const existing = existingReviews[char.id]
            const isGenerating = generating && selectedChar?.id === char.id
            return (
              <div key={char.id} className="cr-char-row">
                <div className="cr-char-info">
                  <span className="cr-char-avatar">{char.avatar}</span>
                  <div className="cr-char-meta">
                    <span className="cr-char-name">{char.name}</span>
                    <span className="cr-char-label">{char.label}</span>
                  </div>
                </div>

                {existing ? (
                  <div className="cr-result">
                    {renderStars(existing.stars)}
                    <p className="cr-review-text">{existing.review}</p>
                    <button
                      className="cr-regen-btn"
                      onClick={() => handleGenerate(char)}
                      disabled={generating}
                    >
                      重新生成
                    </button>
                  </div>
                ) : (
                  <button
                    className="cr-gen-btn"
                    onClick={() => handleGenerate(char)}
                    disabled={generating}
                  >
                    {isGenerating ? '生成中…' : '生成书评'}
                  </button>
                )}
                {isGenerating && !existing && (
                  <div className="cr-generating">生成中…</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
