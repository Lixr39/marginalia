interface Props {
  roman: string
  /** Italic title — e.g. "In Progress", "The Voices". May contain a span with class section-h__em for accent color. */
  title?: string
  /** Accented part of title — e.g. "Progress" in "In Progress". */
  titleAccent?: string
  /** Title prefix before the accented part — e.g. "In " in "In Progress". */
  titlePrefix?: string
  /** Small caps subtitle below — e.g. "FOUR VOLUMES · CURRENTLY READING". */
  sub?: string
  /** Decorative ✦ ✦ ✦ ornament below sub. */
  ornament?: boolean
  /** Compact label — e.g. "IN PROGRESS". Only used when no title. (legacy mode) */
  label?: string
  /** Compact count — e.g. "FOUR VOLUMES". Only used when no title. (legacy mode) */
  count?: string
}

export function SectionHeader({ roman, title, titleAccent, titlePrefix, sub, ornament, label, count }: Props) {
  // Editorial style (preferred): eyebrow + italic title + small caps sub
  if (title || titleAccent) {
    return (
      <div className="section-h">
        <div className="section-h__eyebrow">{roman}</div>
        <h2 className="section-h__title">
          {titlePrefix}
          {titleAccent && <em className="section-h__em">{titleAccent}</em>}
          {!titleAccent && title}
        </h2>
        {sub && <div className="section-h__sub">{sub}</div>}
        {ornament && <div className="section-h__orn">✦ ✦ ✦</div>}
      </div>
    )
  }

  // Compact legacy mode (used by Voices presets list etc.)
  return (
    <div className="section-h section-h--compact">
      <span>
        <span className="section-h__roman">{roman}</span>
        <span className="section-h__label">{label}</span>
      </span>
      {count && <span className="section-h__count">{count}</span>}
    </div>
  )
}
