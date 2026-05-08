interface Props {
  value: number
  label?: string
}

export function Folio({ value, label = 'PCT' }: Props) {
  return (
    <div className="folio">
      <div className="folio__num">{value}</div>
      <div className="folio__mark" aria-hidden />
      <div className="folio__lbl">{label}</div>
    </div>
  )
}
