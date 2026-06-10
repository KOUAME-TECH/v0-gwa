'use client'
import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineBanner() {
  const [status, setStatus] = useState<'online'|'offline'|'restored'>('online')

  useEffect(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) setStatus('offline')
    const goOff = () => setStatus('offline')
    const goOn  = () => { setStatus('restored'); setTimeout(() => setStatus('online'), 3000) }
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
        <><WifiOff className="h-3 w-3" /> Hors ligne</>
      ) : (
        <><Wifi className="h-3 w-3" /> Connexion retablie</>
      )}
    </div>
  )
}
