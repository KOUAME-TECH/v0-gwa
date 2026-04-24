"use client"

import { useState, useEffect, useCallback } from "react"

type ConnectionType = "4g" | "3g" | "2g" | "slow-2g" | "offline" | "unknown"

interface NetworkStatus {
  isOnline: boolean
  connectionType: ConnectionType
  effectiveType: string
  downlink: number // Mbps
  rtt: number // ms
  saveData: boolean
  isSlowConnection: boolean
}

// Per spec: "3G reel 1-3 Mbps en zones urbaines. Edge/2G en zones rurales."
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    connectionType: "unknown",
    effectiveType: "4g",
    downlink: 10,
    rtt: 50,
    saveData: false,
    isSlowConnection: false,
  })

  const updateStatus = useCallback(() => {
    if (typeof window === "undefined") return

    const isOnline = navigator.onLine

    // Use Network Information API if available
    const connection = (navigator as any).connection || 
                       (navigator as any).mozConnection || 
                       (navigator as any).webkitConnection

    if (connection) {
      const effectiveType = connection.effectiveType || "4g"
      const downlink = connection.downlink || 10
      const rtt = connection.rtt || 50
      const saveData = connection.saveData || false

      // Determine connection quality
      let connectionType: ConnectionType = "unknown"
      if (!isOnline) {
        connectionType = "offline"
      } else if (effectiveType === "slow-2g" || effectiveType === "2g") {
        connectionType = effectiveType as ConnectionType
      } else if (effectiveType === "3g" || downlink < 1.5) {
        connectionType = "3g"
      } else {
        connectionType = "4g"
      }

      // Is it a slow connection? (less than 1.5 Mbps or high latency)
      const isSlowConnection = 
        !isOnline || 
        effectiveType === "slow-2g" || 
        effectiveType === "2g" ||
        downlink < 1.5 ||
        rtt > 400 ||
        saveData

      setStatus({
        isOnline,
        connectionType,
        effectiveType,
        downlink,
        rtt,
        saveData,
        isSlowConnection,
      })
    } else {
      // Fallback for browsers without Network Information API
      setStatus(prev => ({
        ...prev,
        isOnline,
        connectionType: isOnline ? "unknown" : "offline",
        isSlowConnection: !isOnline,
      }))
    }
  }, [])

  useEffect(() => {
    updateStatus()

    // Listen for online/offline events
    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)

    // Listen for connection changes (if supported)
    const connection = (navigator as any).connection
    if (connection) {
      connection.addEventListener("change", updateStatus)
    }

    return () => {
      window.removeEventListener("online", updateStatus)
      window.removeEventListener("offline", updateStatus)
      if (connection) {
        connection.removeEventListener("change", updateStatus)
      }
    }
  }, [updateStatus])

  return status
}

// Hook for adaptive loading based on connection
export function useAdaptiveLoading() {
  const { isSlowConnection, saveData, connectionType } = useNetworkStatus()

  return {
    // Image quality (1-100)
    imageQuality: isSlowConnection || saveData ? 50 : 75,
    
    // Should lazy load non-critical content
    shouldLazyLoad: true,
    
    // Should disable animations
    reduceMotion: saveData || connectionType === "2g" || connectionType === "slow-2g",
    
    // Should load videos
    shouldLoadVideos: !isSlowConnection && !saveData,
    
    // Should preload next page
    shouldPreload: !isSlowConnection && !saveData,
    
    // Max items to load initially
    initialLoadCount: isSlowConnection ? 5 : 10,
    
    // Batch size for infinite scroll
    batchSize: isSlowConnection ? 5 : 10,
  }
}

// Data saver mode hook
export function useDataSaver() {
  const [isEnabled, setIsEnabled] = useState(false)
  
  useEffect(() => {
    // Check user preference
    const saved = localStorage.getItem("gwa-data-saver")
    if (saved !== null) {
      setIsEnabled(saved === "true")
      return
    }
    
    // Auto-enable on slow connections
    const connection = (navigator as any).connection
    if (connection?.saveData || connection?.effectiveType === "2g") {
      setIsEnabled(true)
    }
  }, [])
  
  const toggle = useCallback(() => {
    setIsEnabled(prev => {
      const newValue = !prev
      localStorage.setItem("gwa-data-saver", String(newValue))
      return newValue
    })
  }, [])
  
  return { isEnabled, toggle }
}
