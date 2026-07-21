import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Ensoleillé", icon: "sun" },
  1: { label: "Peu nuageux", icon: "cloud-sun" },
  2: { label: "Partiellement nuageux", icon: "cloud-sun" },
  3: { label: "Couvert", icon: "cloud" },
  45: { label: "Brouillard", icon: "cloud-fog" },
  48: { label: "Brouillard givrant", icon: "cloud-fog" },
  51: { label: "Bruine légère", icon: "cloud-drizzle" },
  53: { label: "Bruine", icon: "cloud-drizzle" },
  55: { label: "Bruine forte", icon: "cloud-drizzle" },
  61: { label: "Pluie légère", icon: "cloud-rain" },
  63: { label: "Pluie", icon: "cloud-rain" },
  65: { label: "Forte pluie", icon: "cloud-rain" },
  71: { label: "Neige légère", icon: "cloud-snow" },
  73: { label: "Neige", icon: "cloud-snow" },
  75: { label: "Forte neige", icon: "cloud-snow" },
  80: { label: "Averses", icon: "cloud-rain" },
  81: { label: "Averses modérées", icon: "cloud-rain" },
  82: { label: "Averses violentes", icon: "cloud-rain" },
  95: { label: "Orage", icon: "cloud-lightning" },
  96: { label: "Orage grêle", icon: "cloud-lightning" },
  99: { label: "Orage forte grêle", icon: "cloud-lightning" },
}

/** Secours offline / Open-Meteo down — l'UI météo ne casse jamais. */
function fallbackWeather(city: string) {
  return {
    city,
    degraded: true,
    current: {
      temp: 28,
      humidity: 70,
      windSpeed: 10,
      weather: { label: "Données indisponibles", icon: "cloud" },
    },
    forecast: [],
    tips: ["Météo temporairement indisponible — réessayez plus tard."],
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get("lat") || "5.36"
  const lon = searchParams.get("lon") || "-4.01"
  const city = searchParams.get("city") || "Abidjan"

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum&timezone=auto&forecast_days=5`,
      {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(8000),
      },
    )

    if (!res.ok) throw new Error("Open-Meteo API error")
    const data = await res.json()

    const current = data.current
    const weatherInfo =
      WEATHER_CODES[current.weather_code] || { label: "Inconnu", icon: "cloud" }

    const daily = data.daily
    const forecast = daily.time.map((date: string, i: number) => ({
      date,
      tempMax: daily.temperature_2m_max[i],
      tempMin: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_sum[i],
      weather: WEATHER_CODES[daily.weather_code[i]] || { label: "Inconnu", icon: "cloud" },
    }))

    const tips: string[] = []
    const precip = daily.precipitation_sum.reduce(
      (a: number, b: number) => a + b,
      0,
    )
    if (current.temperature_2m > 32)
      tips.push(
        "Arrosez vos cultures tôt le matin ou tard le soir pour éviter l'évaporation",
      )
    if (precip > 20)
      tips.push("Fortes pluies prévues : vérifiez le drainage de vos parcelles")
    if (current.relative_humidity_2m > 80)
      tips.push("Humidité élevée : surveillez les risques de maladies fongiques")
    if (precip < 2 && current.temperature_2m > 28)
      tips.push(
        "Période sèche : pensez au paillage pour conserver l'humidité du sol",
      )
    if (current.wind_speed_10m > 20)
      tips.push(
        "Vents forts prévus : protégez vos jeunes plants et cultures fragiles",
      )
    if (tips.length === 0) tips.push("Conditions favorables pour les travaux agricoles")

    return NextResponse.json({
      city,
      degraded: false,
      current: {
        temp: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        weather: weatherInfo,
      },
      forecast,
      tips,
    })
  } catch (err) {
    console.warn("[weather] fallback", err)
    return NextResponse.json(fallbackWeather(city), { status: 200 })
  }
}
