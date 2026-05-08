interface Props {
  roman: string
  label: string
  count?: string
}

export function SectionHeader({ roman, label, count }: Props) {
  return (
    <div className="section-h">
      <span>
        <span className="section-h__roman">{roman}</span>
        <span className="section-h__label">{label}</span>
      </span>
      {count && <span className="section-h__count">{count}</span>}
    </div>
  )
}
