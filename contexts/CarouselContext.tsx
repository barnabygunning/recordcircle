'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface CarouselContextType {
  carouselRotation: number
  setCarouselRotation: (rotation: number | ((prev: number) => number)) => void
  saveRotationToStorage: () => void
}

const CarouselContext = createContext<CarouselContextType | undefined>(undefined)

const STORAGE_KEY = 'carousel-rotation'

export function CarouselProvider({ children }: { children: ReactNode }) {
  // Always start with 0 to avoid hydration mismatch
  // We'll read from localStorage after mount (client-side only)
  const [carouselRotation, setCarouselRotationState] = useState(0)

  // Read from localStorage after mount (client-side only) to avoid hydration errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored !== null && stored !== '') {
          const parsed = parseFloat(stored)
          if (!isNaN(parsed)) {
            setCarouselRotationState(parsed)
          }
        }
      } catch (e) {
        console.warn('Failed to read carousel rotation from localStorage:', e)
      }
    }
  }, []) // Only run once on mount

  // Don't auto-save to localStorage - only save when explicitly requested (e.g., when album is selected)
  // Wrapper to update state (without auto-saving to localStorage)
  const setCarouselRotation = (rotation: number | ((prev: number) => number)) => {
    setCarouselRotationState(prev => {
      const newRotation = typeof rotation === 'function' ? rotation(prev) : rotation
      return newRotation
    })
  }
  
  // Function to explicitly save current rotation to localStorage (call when album is selected)
  const saveRotationToStorage = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, carouselRotation.toString())
      } catch (e) {
        console.warn('Failed to save carousel rotation to localStorage:', e)
      }
    }
  }

  return (
    <CarouselContext.Provider value={{ carouselRotation, setCarouselRotation, saveRotationToStorage }}>
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
