import { useStore } from '../store'

export function Boot() {
  const phase = useStore((s) => s.phase)
  const note = useStore((s) => s.bootNote)
  if (phase !== 'boot') return null
  return <div className="boot-toast" role="status"><div className="boot-toast-title"><span className="small-loader" />Preparando sua conversa</div><p>{note || 'Inicializando áudio e verificando suas conexões.'}</p><div className="boot-progress"><i /></div></div>
}
