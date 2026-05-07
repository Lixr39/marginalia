// src/App.tsx
import { Routes, Route } from 'react-router-dom'

function Placeholder() {
  return (
    <main style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 22px',
      gap: 8,
    }}>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'var(--fs-wordmark)',
        fontWeight: 600,
        letterSpacing: 'var(--ls-wordmark)',
        paddingLeft: 7,
      }}>MARGINALIA</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-micro)',
        letterSpacing: 'var(--ls-mono)',
        opacity: 0.55,
      }}>NO. 001 · IN CONSTRUCTION</div>
      <div style={{
        height: 1,
        width: 80,
        background: 'var(--c-text)',
        margin: '8px 0',
        position: 'relative',
      }}>
        <span style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--c-bg)',
          color: 'var(--c-accent)',
          fontSize: 8,
          padding: '0 6px',
        }}>◆</span>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  )
}
