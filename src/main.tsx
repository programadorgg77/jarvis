import { createRoot } from 'react-dom/client'
import './index.css'
import './ocular.css'
import './world.css'
import './neural.css'
import './reference.css'
import './god-eye.css'
import App from './App.tsx'

// Deliberately no StrictMode: its double-invoked effects would open the
// microphone and arm the wake-word engine twice, and the second subscription
// steals the audio stream from the first.
createRoot(document.getElementById('root')!).render(<App />)
