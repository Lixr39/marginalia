import { DiamondRule } from '../../components/shared/DiamondRule'

interface Props {
  issueNo: number
  date: string
}

export function Masthead({ issueNo, date }: Props) {
  const issueStr = `NO. ${String(issueNo).padStart(3, '0')}`
  return (
    <header className="masthead">
      <div className="masthead__wordmark">MARGINALIA</div>
      <div className="masthead__meta">
        <span>{issueStr}</span>
        <span>{date}</span>
      </div>
      <DiamondRule />
    </header>
  )
}
