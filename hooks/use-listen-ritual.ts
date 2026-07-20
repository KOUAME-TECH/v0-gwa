"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "gwa-listen-ritual"
const STREAK_GOAL = 7

type RitualState = {
  streak: number
  lastDate: string | null
  totalListens: number
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function readState(): RitualState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { streak: 0, lastDate: null, totalListens: 0 }
    return JSON.parse(raw) as RitualState
  } catch {
    return { streak: 0, lastDate: null, totalListens: 0 }
  }
}

function writeState(state: RitualState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* private mode */
  }
}

/** Rituels Harmattan — streak d'écoute quotidienne (rétention douce). */
export function useListenRitual() {
  const [state, setState] = useState<RitualState>({ streak: 0, lastDate: null, totalListens: 0 })
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(readState())
    setHydrated(true)
  }, [])

  const recordListen = useCallback(() => {
    setState((prev) => {
      const today = todayKey()
      if (prev.lastDate === today) {
        const next = { ...prev, totalListens: prev.totalListens + 1 }
        writeState(next)
        return next
      }

      const streak =
        prev.lastDate === yesterdayKey() ? prev.streak + 1 : 1

      const next = {
        streak,
        lastDate: today,
        totalListens: prev.totalListens + 1,
      }
      writeState(next)
      return next
    })
  }, [])

  return {
    streak: hydrated ? state.streak : 0,
    totalListens: hydrated ? state.totalListens : 0,
    goal: STREAK_GOAL,
    completed: hydrated && state.streak >= STREAK_GOAL,
    recordListen,
    hydrated,
  }
}

export { STREAK_GOAL as LISTEN_RITUAL_GOAL }

/** Enregistre une écoute sans hook (depuis les contrôles audio). */
export function recordListenActivity() {
  const today = todayKey()
  const prev = readState()

  if (prev.lastDate === today) {
    writeState({ ...prev, totalListens: prev.totalListens + 1 })
    return
  }

  const streak = prev.lastDate === yesterdayKey() ? prev.streak + 1 : 1
  writeState({
    streak,
    lastDate: today,
    totalListens: prev.totalListens + 1,
  })
}
