import { Routes, Route } from 'react-router-dom'
import { TabBar } from './components/shared/TabBar'
import { Library } from './views/Library/Library'
import { Reader } from './views/Reader/Reader'
import './components/shared/shared.css'

function Placeholder({ name }: { name: string }) {
  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 80,
    }}>
      <p style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 14,
        opacity: 0.5,
      }}>
        {name} · placeholder
      </p>
    </main>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:bookId" element={<Reader />} />
        <Route path="/voices" element={<Placeholder name="Voices" />} />
        <Route path="/stats" element={<Placeholder name="Stats" />} />
        <Route path="/setup" element={<Placeholder name="Setup" />} />
      </Routes>
      <TabBar />
    </>
  )
}
