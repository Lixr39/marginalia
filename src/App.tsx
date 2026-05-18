import { Routes, Route } from 'react-router-dom'
import { TabBar } from './components/shared/TabBar'
import { Library } from './views/Library/Library'
import { Reader } from './views/Reader/Reader'
import { Setup } from './views/Setup/Setup'
import { Voices } from './views/Voices/Voices'
import { Stats } from './views/Stats/Stats'
import './components/shared/shared.css'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Library />} />
        <Route path="/read/:bookId" element={<Reader />} />
        <Route path="/voices" element={<Voices />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/setup" element={<Setup />} />
      </Routes>
      <TabBar />
    </>
  )
}
