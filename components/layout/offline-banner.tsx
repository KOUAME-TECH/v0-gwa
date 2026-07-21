'use client'
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { loadOfflineDraft } from '@/lib/offline/drafts'
import { createClient } from '@/lib/supabase/client'

export function OfflineBanner() {
  const [status, setStatus] = useState<'online'|'offline'|'restored'>('online')
  const [draftHint, setDraftHint] = useState(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) setStatus('offline')
    const goOff = () => setStatus('offline')
    const goOn = async () => {
      setStatus('restored')
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const product = await loadOfflineDraft(user.id, 'product')
          const post = await loadOfflineDraft(user.id, 'post')
          setDraftHint(!!(product || post))
        }
      } catch {
        // ignore
      }
      setTimeout(() => {
        setStatus('online')
        setDraftHint(false)
      }, 4500)
    }
    window.addEventListener('offline', goOff)
    window.addEventListener('online', goOn)
    return () => { window.removeEventListener('offline', goOff); window.removeEventListener('online', goOn) }
  }, [])

  if (status === 'online') return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center 
      gap-2 px-4 py-2 text-xs font-semibold animate-slideUp ${
      status === 'offline' 
        ? 'bg-amber-500 text-white' 
        : 'bg-green-500 text-white'
    }`}>
      {status === 'offline' ? (
        <><WifiOff className="h-3 w-3" /> Hors ligne — brouillons sauvegardés sur /publier</>
      ) : (
        <>
          <Wifi className="h-3 w-3" />
          {draftHint
            ? 'Connexion rétablie — ouvre /publier pour reprendre ton brouillon'
            : 'Connexion rétablie'}
        </>
      )}
    </div>
  )
}
