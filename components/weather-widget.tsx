"use client"

import { useEffect, useState } from "react"
import { Cloud, CloudDrizzle, CloudLightning, CloudRain, CloudSnow, Droplets, Sun, Wind, Thermometer, Sprout } from "lucide-react"

interface WeatherData {
  city: string
  current: {
    temp: number
    humidity: number
    windSpeed: number
    weather: { label: string; icon: string }
  }
  forecast: {
    date: string
    tempMax: number
    tempMin: number
    precipitation: number
    weather: { label: string; icon: string }
  }[]
  tips: string[]
}

function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = className || "h-5 w-5"
  switch (icon) {
    case "sun": return <Sun className={cls} />
    case "cloud-sun": return <Sun className={cls} />
    case "cloud": return <Cloud className={cls} />
    case "cloud-drizzle": return <CloudDrizzle className={cls} />
    case "cloud-rain": return <CloudRain className={cls} />
    case "cloud-snow": return <CloudSnow className={cls} />
    case "cloud-lightning": return <CloudLightning className={cls} />
    default: return <Cloud className={cls} />
  }
}

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWeather() {
      try {
        // Réutiliser le cache GPS partagé (évite un 2e prompt / double GPS)
        try {
          const raw = localStorage.getItem("gwa-realtime-location")
          if (raw) {
            const cached = JSON.parse(raw) as {
              lat?: number
              lon?: number
              city?: string | null
            }
            if (typeof cached.lat === "number" && typeof cached.lon === "number") {
              const city = cached.city || "Ma position"
              const res = await fetch(
                `/api/weather?lat=${cached.lat}&lon=${cached.lon}&city=${encodeURIComponent(city)}`,
              )
              if (res.ok) {
                setWeather(await res.json())
                setLoading(false)
                return
              }
            }
          }
        } catch {
          /* continue GPS */
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const res = await fetch(
                `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&city=Ma position`,
              )
              if (res.ok) setWeather(await res.json())
              setLoading(false)
            },
            async () => {
              const res = await fetch("/api/weather")
              if (res.ok) setWeather(await res.json())
              setLoading(false)
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300_000 },
          )
        } else {
          const res = await fetch("/api/weather")
          if (res.ok) setWeather(await res.json())
          setLoading(false)
        }
      } catch {
        setLoading(false)
      }
    }
    void loadWeather()
  }, [])

  if (loading) {
    return (
      <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-br from-[#1E88E5] to-[#1565C0] p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-white/20 rounded w-24" />
            <div className="h-3 bg-white/20 rounded w-32" />
          </div>
        </div>
      </div>
    )
  }

  if (!weather) return null

  return (
    <div className="mx-4 mt-3 rounded-2xl overflow-hidden bg-gradient-to-br from-[#1E88E5] to-[#1565C0] text-white">
      {/* Current */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/70 text-xs font-medium">{weather.city}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{weather.current.temp}</span>
              <span className="text-lg text-white/80">°C</span>
            </div>
            <p className="text-sm text-white/90">{weather.current.weather.label}</p>
          </div>
          <WeatherIcon icon={weather.current.weather.icon} className="h-14 w-14 text-white/90" />
        </div>

        <div className="flex gap-4 text-xs text-white/80">
          <span className="flex items-center gap-1"><Droplets className="h-3.5 w-3.5" />{weather.current.humidity}%</span>
          <span className="flex items-center gap-1"><Wind className="h-3.5 w-3.5" />{weather.current.windSpeed} km/h</span>
        </div>

        {/* 5-day forecast */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {weather.forecast.map((day, i) => {
            const d = new Date(day.date)
            return (
              <div key={day.date} className={`flex flex-col items-center gap-1 min-w-[52px] py-2 px-1 rounded-xl ${i === 0 ? "bg-white/20" : ""}`}>
                <span className="text-[10px] text-white/70 font-medium">{i === 0 ? "Auj" : DAYS_FR[d.getDay()]}</span>
                <WeatherIcon icon={day.weather.icon} className="h-4 w-4 text-white/90" />
                <div className="flex gap-0.5 text-[10px]">
                  <span className="font-semibold">{Math.round(day.tempMax)}°</span>
                  <span className="text-white/60">{Math.round(day.tempMin)}°</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Agri tips */}
      {weather.tips.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm px-4 py-3 border-t border-white/10">
          <div className="flex items-start gap-2">
            <Sprout className="h-4 w-4 text-[#81C784] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-semibold text-white/90 uppercase tracking-wide mb-0.5">Conseil agricole</p>
              <p className="text-xs text-white/80 leading-relaxed">{weather.tips[0]}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
