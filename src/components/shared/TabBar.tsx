import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/',       roman: 'I.',   label: 'LIBRARY' },
  { to: '/voices', roman: 'II.',  label: 'VOICES'  },
  { to: '/stats',  roman: 'III.', label: 'STATS'   },
  { to: '/setup',  roman: 'IV.',  label: 'SETUP'   },
]

export function TabBar() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/read/')) return null

  return (
    <nav className="tab-bar" role="tablist">
      {TABS.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) =>
            'tab-bar__item' + (isActive ? ' tab-bar__item--active' : '')
          }
        >
          <span><span className="tab-bar__roman">{t.roman}</span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
