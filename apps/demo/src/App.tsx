import { MapDemo } from './MapDemo'

export function App() {
  return (
    <main style={{ maxWidth: 1200, padding: 32, fontFamily: 'system-ui, sans-serif' }}>
      <h1>EVE Online Tools</h1>
      <p>Demo showcase for React component packages.</p>
      <h2>eve-map</h2>
      <MapDemo />
    </main>
  )
}
