import { useEffect } from 'react'
import { useStore, accentFor } from '../store'
import { Blades } from './Blades'
import { Effects } from './Effects'
import { Pointer } from './Pointer'
import { GestureGuide } from './GestureGuide'
import { OcularInterface, type AssistantActions } from './OcularInterface'

export function Hud(actions: AssistantActions) {
  const phase = useStore((s) => s.phase)
  const ui = useStore((s) => s.ui)
  const gestures = useStore((s) => s.gestures)
  const looking = useStore((s) => s.looking)
  useEffect(() => {
    const root = document.documentElement
    if (ui.background) root.style.setProperty('--bg', ui.background)
    else root.style.removeProperty('--bg')
  }, [ui.background])
  return <div className="hud ocular-shell" style={{ ['--accent' as string]: accentFor(phase, ui) }}>
    <OcularInterface {...actions} />
    <Blades /><Effects /><Pointer />
    {(gestures || looking) && <div className="hands-live">{looking ? `Câmera ativa · ${looking}` : 'Controle por gestos ativo · G para desativar'}</div>}
    <GestureGuide live={gestures} />
  </div>
}
