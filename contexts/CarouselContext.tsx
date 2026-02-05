'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { ViewMode } from '@/constants/carousel'
import {
  DEFAULT_RADIUS,
  DEFAULT_COVER_SCALE,
  DEFAULT_CENTRAL_ALBUM_SCALE,
  DEFAULT_VIEW_MODE,
  DEFAULT_PLAN_VIEW_TILT,
  DEFAULT_PLAN_CENTER_ABOVE,
  DEFAULT_PERSPECTIVE,
  DEFAULT_ANGLE_STEP,
  SENSITIVITY,
  DEFAULT_DAMPING,
  DEFAULT_SPRING_STRENGTH,
  DEBUGGER_VISIBLE,
} from '@/constants/carousel'

export interface CarouselSettings {
  carouselRotation: number
  radius: number
  coverScale: number
  centralAlbumScale: number
  viewMode: ViewMode
  planViewTilt: number
  planCenterAbove: boolean
  perspective: number
  angleStep: number
  sensitivity: number
  damping: number
  springStrength: number
  settingsVisible: boolean
}

const DEFAULT_SETTINGS: CarouselSettings = {
  carouselRotation: 0,
  radius: DEFAULT_RADIUS,
  coverScale: DEFAULT_COVER_SCALE,
  centralAlbumScale: DEFAULT_CENTRAL_ALBUM_SCALE,
  viewMode: DEFAULT_VIEW_MODE,
  planViewTilt: DEFAULT_PLAN_VIEW_TILT,
  planCenterAbove: DEFAULT_PLAN_CENTER_ABOVE,
  perspective: DEFAULT_PERSPECTIVE,
  angleStep: DEFAULT_ANGLE_STEP,
  sensitivity: SENSITIVITY,
  damping: DEFAULT_DAMPING,
  springStrength: DEFAULT_SPRING_STRENGTH,
  settingsVisible: DEBUGGER_VISIBLE,
}

interface CarouselContextType extends CarouselSettings {
  updateSettings: (partial: Partial<CarouselSettings>) => void
  setCarouselRotation: (rotation: number | ((prev: number) => number)) => void
  saveRotationToStorage: () => void
}

const CarouselContext = createContext<CarouselContextType | undefined>(undefined)

const STORAGE_KEY = 'carousel-settings'

function loadStoredSettings(): Partial<CarouselSettings> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<CarouselSettings>
      return parsed
    }
  } catch (e) {
    console.warn('Failed to load carousel settings from localStorage:', e)
  }
  return {}
}

function saveSettings(settings: CarouselSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('Failed to save carousel settings to localStorage:', e)
  }
}

export function CarouselProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CarouselSettings>(DEFAULT_SETTINGS)
  const [hasHydrated, setHasHydrated] = useState(false)

  // Load from localStorage after mount (client-side only) to avoid hydration errors
  useEffect(() => {
    const stored = loadStoredSettings()
    if (Object.keys(stored).length > 0) {
      setSettingsState(prev => ({
        ...prev,
        ...stored,
        // Ensure viewMode is valid
        viewMode: stored.viewMode === 'plan' ? 'plan' : prev.viewMode,
      }))
    }
    setHasHydrated(true)
  }, [])

  // Persist to localStorage when settings change (after initial hydration)
  useEffect(() => {
    if (hasHydrated) {
      saveSettings(settings)
    }
  }, [hasHydrated, settings])

  const updateSettings = useCallback((partial: Partial<CarouselSettings>) => {
    setSettingsState(prev => ({ ...prev, ...partial }))
  }, [])

  const setCarouselRotation = useCallback((rotation: number | ((prev: number) => number)) => {
    setSettingsState(prev => ({
      ...prev,
      carouselRotation: typeof rotation === 'function' ? rotation(prev.carouselRotation) : rotation,
    }))
  }, [])

  const saveRotationToStorage = useCallback(() => {
    saveSettings(settings)
  }, [settings])

  const value: CarouselContextType = {
    ...settings,
    updateSettings,
    setCarouselRotation,
    saveRotationToStorage,
  }

  return (
    <CarouselContext.Provider value={value}>
      {children}
    </CarouselContext.Provider>
  )
}

export function useCarousel() {
  const context = useContext(CarouselContext)
  if (context === undefined) {
    throw new Error('useCarousel must be used within a CarouselProvider')
  }
  return context
}
