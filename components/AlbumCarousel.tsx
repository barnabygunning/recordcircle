'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Slider, Box, Typography, ToggleButtonGroup, ToggleButton, Button, IconButton } from '@mui/material'
import { ViewCarousel, Album, ArrowCircleUp, ArrowCircleDown } from '@mui/icons-material'
import styles from './AlbumCarousel.module.css'
import { getAlbumImagePath, getAlbumImageSrcSet, parseAlbumFilename } from '@/utils/imageUtils'

interface Album {
  id: number
  filename: string
}

interface VisibleAlbum {
  album: Album
  albumIndex: number // Index in the full albums array
  baseAngle: number // Fixed angle in the carousel (-12 to +12)
}

interface AlbumCarouselProps {
  albums: Album[]
}

import {
  MAX_VISIBLE,
  MIN_ANGLE,
  MAX_ANGLE,
  DEFAULT_ANGLE_STEP,
  DEFAULT_RADIUS,
  MIN_RADIUS,
  MAX_RADIUS,
  DEFAULT_COVER_SCALE,
  MIN_COVER_SCALE,
  MAX_COVER_SCALE,
  DEFAULT_CENTRAL_ALBUM_SCALE,
  MIN_CENTRAL_ALBUM_SCALE,
  MAX_CENTRAL_ALBUM_SCALE,
  DEFAULT_VIEW_MODE,
  DEFAULT_PLAN_VIEW_TILT,
  DEFAULT_PLAN_CENTER_ABOVE,
  MIN_PLAN_VIEW_TILT,
  MAX_PLAN_VIEW_TILT,
  MIN_ANGLE_STEP,
  MAX_ANGLE_STEP,
  DEFAULT_PERSPECTIVE,
  MIN_PERSPECTIVE,
  MAX_PERSPECTIVE,
  DEFAULT_DAMPING,
  DEFAULT_SPRING_STRENGTH,
  MIN_VELOCITY,
  SNAP_THRESHOLD,
  SENSITIVITY,
  FRAME_RATE,
} from '@/constants/carousel'
import type { ViewMode } from '@/constants/carousel'
import { useCarousel } from '@/contexts/CarouselContext'

export default function AlbumCarousel({ albums }: AlbumCarouselProps) {
  const router = useRouter()
  const totalAlbums = albums.length
  const {
    carouselRotation,
    setCarouselRotation,
    radius,
    coverScale,
    centralAlbumScale,
    viewMode,
    planViewTilt,
    planCenterAbove,
    perspective,
    angleStep,
    sensitivity,
    damping,
    springStrength,
    settingsVisible,
    updateSettings,
  } = useCarousel()
  const [viewportSize, setViewportSize] = useState({ width: 1920, height: 1080 })
  
  const albumSize = Math.floor(viewportSize.height * coverScale)
  
  // Initialize visible albums: centered around index 0
  const initializeVisibleAlbums = (step: number): VisibleAlbum[] => {
    const visible: VisibleAlbum[] = []
    const centerIndex = 0
    const albumsNeeded = Math.ceil((MAX_ANGLE - MIN_ANGLE) / step) + 1
    const halfVisible = Math.floor(albumsNeeded / 2)
    for (let i = -halfVisible; i <= halfVisible; i++) {
      const albumIndex = (centerIndex + i + totalAlbums) % totalAlbums
      visible.push({
        album: albums[albumIndex],
        albumIndex,
        baseAngle: i * step,
      })
    }
    return visible
  }
  
  // Update viewport dimensions on resize
  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }
    
    updateViewportSize()
    window.addEventListener('resize', updateViewportSize)
    return () => window.removeEventListener('resize', updateViewportSize)
  }, [])

  // Keyboard event handler to toggle settings visibility with '=' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '=' || e.key === '+') {
        updateSettings({ settingsVisible: !settingsVisible })
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [settingsVisible, updateSettings])

  const [visibleAlbums, setVisibleAlbums] = useState<VisibleAlbum[]>(() => initializeVisibleAlbums(DEFAULT_ANGLE_STEP))

  // Reinitialize visible albums when angle step changes
  useEffect(() => {
    const visible: VisibleAlbum[] = []
    const centerIndex = 0
    const albumsNeeded = Math.ceil((MAX_ANGLE - MIN_ANGLE) / angleStep) + 1
    const halfVisible = Math.floor(albumsNeeded / 2)
    for (let i = -halfVisible; i <= halfVisible; i++) {
      const albumIndex = (centerIndex + i + totalAlbums) % totalAlbums
      visible.push({
        album: albums[albumIndex],
        albumIndex,
        baseAngle: i * angleStep,
      })
    }
    setVisibleAlbums(visible)
  }, [angleStep, albums, totalAlbums])
  // Initialize rotation ref
  useEffect(() => {
    currentRotationRef.current = carouselRotation
  }, [carouselRotation])
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [shouldAnimate, setShouldAnimate] = useState(false) // Trigger to start animation
  const [targetRotation, setTargetRotation] = useState(0) // Target rotation snapped to 2° increments
  const dragDistanceRef = useRef(0) // Track total drag distance to distinguish clicks from drags
  const rotationVelocityRef = useRef(0) // Angular velocity in degrees per second (using ref to avoid re-renders)
  const currentRotationRef = useRef(0) // Track current rotation for spring physics
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0) // Track time for frame-based calculations
  const lastPointerXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const pointerDownTargetRef = useRef<Element | null>(null) // Track target for click (pointer capture prevents album onClick)
  
  const snapToAngleStep = (rotation: number): number => {
    return Math.round(rotation / angleStep) * angleStep
  }

  // Update carousel rotation and handle album replacement
  const updateCarouselRotation = useCallback((rotationDelta: number) => {
    setCarouselRotation((prev: number) => {
      const newRotation = prev + rotationDelta
      currentRotationRef.current = newRotation // Update ref for spring physics
      
      // Check if any album's effective angle (baseAngle + rotation) exceeds threshold
      setVisibleAlbums(current => {
        const newAlbums: VisibleAlbum[] = []
        let leftmostOutOfBounds: VisibleAlbum | null = null
        let rightmostOutOfBounds: VisibleAlbum | null = null
        let leftmostInBounds: VisibleAlbum | null = null
        let rightmostInBounds: VisibleAlbum | null = null
        let leftmostEffectiveAngle = Infinity
        let rightmostEffectiveAngle = -Infinity
        let leftmostInBoundsAngle = Infinity
        let rightmostInBoundsAngle = -Infinity

        // Maintain albums centered around effectiveAngle = 0°
        // The center album should have baseAngle = -newRotation (so effectiveAngle = 0°)
        const centerBaseAngle = -newRotation
        
        // First pass: separate albums into in-bounds and out-of-bounds
        // In-bounds means effectiveAngle is between MIN_ANGLE and MAX_ANGLE
        for (const va of current) {
          const effectiveAngle = va.baseAngle + newRotation
          
          if (effectiveAngle < MIN_ANGLE) {
            // Album went too far left, will remove it
            if (effectiveAngle < leftmostEffectiveAngle) {
              leftmostOutOfBounds = va
              leftmostEffectiveAngle = effectiveAngle
            }
          } else if (effectiveAngle > MAX_ANGLE) {
            // Album went too far right, will remove it
            if (effectiveAngle > rightmostEffectiveAngle) {
              rightmostOutOfBounds = va
              rightmostEffectiveAngle = effectiveAngle
            }
          } else {
            // Keep this album
            newAlbums.push(va)
            // Track the leftmost and rightmost in-bounds albums
            if (effectiveAngle < leftmostInBoundsAngle) {
              leftmostInBounds = va
              leftmostInBoundsAngle = effectiveAngle
            }
            if (effectiveAngle > rightmostInBoundsAngle) {
              rightmostInBounds = va
              rightmostInBoundsAngle = effectiveAngle
            }
          }
        }
        
        const snapBaseAngle = (angle: number): number => {
          return Math.round(angle / angleStep) * angleStep
        }
        
        if (leftmostOutOfBounds) {
          const prevIndex = (leftmostOutOfBounds.albumIndex - 1 + totalAlbums) % totalAlbums
          // Check if this album is already in the visible list
          const alreadyVisible = newAlbums.some(va => va.albumIndex === prevIndex)
          if (!alreadyVisible) {
            newAlbums.unshift({
              album: albums[prevIndex],
              albumIndex: prevIndex,
              baseAngle: snapBaseAngle(MIN_ANGLE - newRotation), // Set baseAngle so effectiveAngle = MIN_ANGLE
            })
          }
        } else if (leftmostInBounds && leftmostInBoundsAngle > MIN_ANGLE + angleStep) {
          // Proactively add album on left if we have room
          const prevIndex = (leftmostInBounds.albumIndex - 1 + totalAlbums) % totalAlbums
          const alreadyVisible = newAlbums.some(va => va.albumIndex === prevIndex)
          if (!alreadyVisible && newAlbums.length < MAX_VISIBLE) {
            newAlbums.unshift({
              album: albums[prevIndex],
              albumIndex: prevIndex,
              baseAngle: snapBaseAngle((leftmostInBoundsAngle - angleStep) - newRotation),
            })
          }
        }
        
        // If albums went too far right (rotating left), add next album on the right
        if (rightmostOutOfBounds) {
          const nextIndex = (rightmostOutOfBounds.albumIndex + 1) % totalAlbums
          // Check if this album is already in the visible list
          const alreadyVisible = newAlbums.some(va => va.albumIndex === nextIndex)
          if (!alreadyVisible) {
            newAlbums.push({
              album: albums[nextIndex],
              albumIndex: nextIndex,
              baseAngle: snapBaseAngle(MAX_ANGLE - newRotation), // Set baseAngle so effectiveAngle = MAX_ANGLE
            })
          }
        } else if (rightmostInBounds && rightmostInBoundsAngle < MAX_ANGLE - angleStep) {
          // Proactively add album on right if we have room
          const nextIndex = (rightmostInBounds.albumIndex + 1) % totalAlbums
          const alreadyVisible = newAlbums.some(va => va.albumIndex === nextIndex)
          if (!alreadyVisible && newAlbums.length < MAX_VISIBLE) {
            newAlbums.push({
              album: albums[nextIndex],
              albumIndex: nextIndex,
              baseAngle: snapBaseAngle((rightmostInBoundsAngle + angleStep) - newRotation),
            })
          }
        }

        // Ensure we have the correct number of albums
        if (newAlbums.length > MAX_VISIBLE) {
          // Remove the ones furthest from center
          while (newAlbums.length > MAX_VISIBLE) {
            const furthest = newAlbums.reduce((prev, curr) => {
              const prevEffective = prev.baseAngle + newRotation
              const currEffective = curr.baseAngle + newRotation
              return Math.abs(currEffective) > Math.abs(prevEffective) ? curr : prev
            })
            const index = newAlbums.indexOf(furthest)
            newAlbums.splice(index, 1)
          }
        }
        
        // Only return new array if it changed
        if (newAlbums.length !== current.length || 
            newAlbums.some((va, i) => va.albumIndex !== current[i]?.albumIndex)) {
          return newAlbums
        }

        return current
      })
      
      return newRotation
    })
  }, [albums, totalAlbums, angleStep, setCarouselRotation])

  // Physics animation loop
  useEffect(() => {
    if (isDragging) {
      // Stop animation during drag
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      setShouldAnimate(false)
      return
    }

    if (!shouldAnimate) {
      // Don't animate if not triggered
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }
    
    // Check if we're already at target (within threshold)
    const distanceToTarget = Math.abs(targetRotation - currentRotationRef.current)
    if (distanceToTarget < SNAP_THRESHOLD && Math.abs(rotationVelocityRef.current) < MIN_VELOCITY * 2) {
      // Snap to target and stop
      updateCarouselRotation(targetRotation - currentRotationRef.current)
      rotationVelocityRef.current = 0
      setShouldAnimate(false)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    // Start animation loop with spring-damper physics (time-based)
    const animate = (currentTime: number) => {
      // Calculate delta time (in seconds)
      const deltaTime = lastFrameTimeRef.current > 0 
        ? (currentTime - lastFrameTimeRef.current) / 1000 
        : 1 / FRAME_RATE // First frame, assume 60fps
      lastFrameTimeRef.current = currentTime
      
      // Clamp deltaTime to prevent large jumps
      const clampedDeltaTime = Math.min(deltaTime, 1 / 30) // Max 30fps equivalent
      
      const currentVelocity = rotationVelocityRef.current // degrees per second
      const currentRotation = currentRotationRef.current
      const target = targetRotation
      const distanceToTarget = target - currentRotation
      
      // Check if we should snap to target
      if (Math.abs(distanceToTarget) < SNAP_THRESHOLD && Math.abs(currentVelocity) < MIN_VELOCITY) {
        // Snap to target and stop
        updateCarouselRotation(distanceToTarget)
        rotationVelocityRef.current = 0
        setShouldAnimate(false)
        lastFrameTimeRef.current = 0
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }
      
      if (isDragging) {
        // Stop animation if dragging starts
        rotationVelocityRef.current = 0
        setShouldAnimate(false)
        lastFrameTimeRef.current = 0
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = null
        }
        return
      }

      // Spring-damper physics (time-based, natural motion)
      // This creates smooth, natural deceleration with spring snap-to-target
      
      // Spring force: proportional to distance from target
      // Higher springStrength = stronger pull toward target
      // Scale spring strength to work well with time-based physics
      const springForce = springStrength > 0 ? distanceToTarget * springStrength * FRAME_RATE : 0
      
      // Velocity damping: exponential decay based on damping factor
      // damping 1.0 = all velocity removed immediately, damping 0.0 = no damping
      // Use exponential decay for smooth, natural deceleration
      // Convert damping to a per-second decay rate
      const dampingRate = damping * FRAME_RATE // Higher damping = faster decay
      const dampingFactor = Math.exp(-dampingRate * clampedDeltaTime)
      const dampedVelocity = currentVelocity * dampingFactor
      
      // Apply spring force as acceleration (changes velocity over time)
      // Spring force acts as acceleration, multiply by deltaTime to get velocity change
      const springVelocityChange = springForce * clampedDeltaTime
      const newVelocity = dampedVelocity + springVelocityChange
      
      // Update velocity and rotation
      // Convert velocity (degrees/second) to rotation delta (degrees) for this frame
      const rotationDelta = newVelocity * clampedDeltaTime
      rotationVelocityRef.current = newVelocity
      updateCarouselRotation(rotationDelta)
      
      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    if (!animationFrameRef.current) {
      lastFrameTimeRef.current = 0 // Reset time tracking
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isDragging, shouldAnimate, targetRotation, damping, springStrength, updateCarouselRotation])

  // Keep ref in sync for immediate checks in handlers
  useEffect(() => {
    isDraggingRef.current = isDragging
  }, [isDragging])

  // Unified pointer handlers (mouse + touch) - use capture phase so we receive events
  // before 3D-transform hit-testing can fail on the carousel in plan view
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== undefined) return
    // Don't capture when interacting with the settings panel (sliders, buttons, etc.)
    if ((e.target as Element).closest('[data-settings-panel]')) return
    pointerDownTargetRef.current = e.target as Element
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    setIsDragging(true)
    const x = e.clientX
    setStartX(x)
    lastPointerXRef.current = x
    dragDistanceRef.current = 0
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    if (e.pointerType === 'mouse' && e.buttons === 0) return
    e.preventDefault()
    const currentX = e.clientX
    const deltaX = currentX - lastPointerXRef.current
    lastPointerXRef.current = currentX

    dragDistanceRef.current += Math.abs(deltaX)
    const rotationDelta = deltaX * sensitivity
    updateCarouselRotation(rotationDelta)
    const instantVelocity = (deltaX * sensitivity) / 0.016 // ~60fps
    rotationVelocityRef.current = instantVelocity
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== undefined) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    isDraggingRef.current = false
    setIsDragging(false)
    // Pointer capture prevents album onClick from firing - handle click here when it was a tap (not drag)
    if (Math.abs(dragDistanceRef.current) < 5) {
      const albumEl = pointerDownTargetRef.current?.closest('[data-album-id]')
      if (albumEl) {
        const albumId = parseInt(albumEl.getAttribute('data-album-id') ?? '', 10)
        if (!isNaN(albumId)) {
          e.preventDefault()
          e.stopPropagation()
          router.push(`/album/${albumId}`)
        }
      }
    }
    pointerDownTargetRef.current = null
    setTimeout(() => { dragDistanceRef.current = 0 }, 100)
    setCarouselRotation(current => {
      const snappedTarget = snapToAngleStep(current)
      setTargetRotation(snappedTarget)
      return current
    })
    setShouldAnimate(true)
  }

  const handlePointerCancel = (e: React.PointerEvent) => {
    handlePointerUp(e)
  }

  const handleAlbumClick = (e: React.MouseEvent, albumId: number) => {
    // Only navigate if it was a click (small drag distance) and not currently dragging
    if (!isDragging && Math.abs(dragDistanceRef.current) < 5) {
      e.preventDefault()
      e.stopPropagation()
      router.push(`/album/${albumId}`)
    }
  }

  const sliderControl = (
    label: string,
    value: number,
    onChange: (v: number) => void,
    min: number,
    max: number,
    step: number,
    format: (v: number) => string
  ) => (
    <Box sx={{ width: '100%' }}>
      <Typography variant="caption" sx={{ color: 'white', display: 'block', marginBottom: '0.5rem' }}>
        {label}: {format(value)}
      </Typography>
      <Slider
        value={value}
        onChange={(_, v) => onChange(v as number)}
        min={min}
        max={max}
        step={step}
        sx={{
          color: 'white',
          '& .MuiSlider-thumb': { backgroundColor: 'white' },
          '& .MuiSlider-track': { backgroundColor: 'white' },
          '& .MuiSlider-rail': { backgroundColor: 'rgba(255, 255, 255, 0.3)' },
        }}
      />
    </Box>
  )

  const handleResetDefaults = () => {
    updateSettings({
      radius: DEFAULT_RADIUS,
      angleStep: DEFAULT_ANGLE_STEP,
      centralAlbumScale: DEFAULT_CENTRAL_ALBUM_SCALE,
      coverScale: DEFAULT_COVER_SCALE,
      viewMode: DEFAULT_VIEW_MODE,
      planViewTilt: DEFAULT_PLAN_VIEW_TILT,
      planCenterAbove: DEFAULT_PLAN_CENTER_ABOVE,
      perspective: DEFAULT_PERSPECTIVE,
      sensitivity: SENSITIVITY,
      damping: DEFAULT_DAMPING,
      springStrength: DEFAULT_SPRING_STRENGTH,
    })
  }

  return (
    <div 
      className={styles.carouselContainer}
      style={{ perspective: `${perspective}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerDownCapture={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        className={styles.carousel}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          transform: viewMode === 'plan'
            ? `translateY(${(planCenterAbove ? -1 : 1) * radius * Math.sin((planViewTilt * Math.PI) / 180)}px) rotateX(${planCenterAbove ? planViewTilt : -planViewTilt}deg)`
            : undefined,
        }}
      >
        {visibleAlbums.map((visibleAlbum) => {
          const { album, baseAngle } = visibleAlbum
          // Effective angle = baseAngle + carouselRotation
          const effectiveAngle = baseAngle + carouselRotation
          const absAngle = Math.abs(effectiveAngle)
          
          const size = albumSize
          
          // Central album scale: interpolate from center (centralAlbumScale) to adjacent albums (1.0)
          const scaleBlend = Math.max(0, 1 - absAngle / angleStep) // 1 at center, 0 beyond one step
          const scaleFactor = 1 + (centralAlbumScale - 1) * scaleBlend
          
          // Opacity: fade out albums further from center
          const maxAngle = Math.abs(MAX_ANGLE)
          const opacity = Math.max(0.6, 1 - (absAngle / maxAngle) * 0.4)
          
          // X position: use trigonometry - sin(effectiveAngle) * radius
          // Convert effective angle to radians for Math.sin
          const angleRad = (effectiveAngle * Math.PI) / 180
          const xOffset = Math.sin(angleRad) * radius
          
          // Z position for 3D depth effect
          // Center albums (angle ~0) should be closer (higher z), side albums further (lower z)
          // Using cos gives us: cos(0) = 1 (closest), cos(90) = 0 (furthest)
          // Use radius to match xOffset for proper circular arrangement
          const zOffset = -Math.cos(angleRad) * radius // Negative z is "into screen", so center albums are less negative
          
          // Rotate album about vertical axis to face center (tangent to ring)
          const rotationY = -effectiveAngle
          // Plan view: albums lie flat like records on a turntable (flip when center below)
          const rotationX = viewMode === 'plan' ? (planCenterAbove ? -90 : 90) : 0
          
          // Z-index: center album (absAngle = 0) should be highest
          const zIndex = Math.round(1000 + (MAX_ANGLE - absAngle) * 10)

          const albumTransform = viewMode === 'plan'
            ? `translate3d(${xOffset}px, 0, ${zOffset}px) rotateY(${rotationY}deg) rotateX(${rotationX}deg) scale(${scaleFactor})`
            : `translate3d(${xOffset}px, 0, ${zOffset}px) rotateY(${rotationY}deg) scale(${scaleFactor})`

          return (
            <div
              key={`${album.id}-${visibleAlbum.albumIndex}`}
              className={styles.albumItem}
              data-album-id={album.id}
              style={{
                transform: albumTransform,
                opacity,
                zIndex,
                width: `${size}px`,
                height: `${size}px`,
                marginLeft: `-${size / 2}px`,
                marginTop: `-${size / 2}px`,
              }}
              onClick={(e) => handleAlbumClick(e, album.id)}
              onTouchEnd={(e) => {
                // Handle touch end for mobile Safari
                if (Math.abs(dragDistanceRef.current) < 5) {
                  e.preventDefault()
                  e.stopPropagation()
                  router.push(`/album/${album.id}`)
                }
              }}
            >
              <div
                className={styles.albumImageContainer}
                style={
                  viewMode === 'plan'
                    ? { backfaceVisibility: 'visible', WebkitBackfaceVisibility: 'visible' }
                    : undefined
                }
              >
                <img
                  src={getAlbumImagePath(album.filename, 1)}
                  alt={parseAlbumFilename(album.filename).title}
                  className={styles.albumImage}
                  width={size}
                  height={size}
                />
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Carousel Settings - press '=' to toggle */}
      {settingsVisible && (
      <Box
        data-settings-panel
        sx={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#00000088',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)', // Safari support
          padding: '1.5rem 2rem',
          borderRadius: '12px',
          zIndex: 1000,
          minWidth: '420px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          touchAction: 'pan-y', // Allow vertical scroll in debug panel (overrides carousel touch-action: none)
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
            Carousel Settings
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleResetDefaults}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
          >
            Reset
          </Button>
        </Box>
        
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          Rotation: {carouselRotation.toFixed(2)}° · Album size: {albumSize}px · Viewport height: {viewportSize.height}px
        </Typography>

        {/* View mode */}
        <Box>
          <Typography variant="caption" sx={{ color: 'white', display: 'block', marginBottom: '0.5rem' }}>
            View mode
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v != null && updateSettings({ viewMode: v })}
            sx={{
              '& .MuiToggleButton-root': {
                color: 'white',
                borderColor: 'rgba(255,255,255,0.5)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.25)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(179, 179, 179, 0.9)',
                  color: 'white',
                  boxShadow: 'inset 0 0 4px rgba(0,0,0,0.25)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.25)',
                  },
                },
              },
            }}
          >
            <ToggleButton value="front" aria-label="Front view (ring)">
              <ViewCarousel />
            </ToggleButton>
            <ToggleButton value="plan" aria-label="Plan view (turntable)">
              <Album />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {sliderControl('Angular spacing', angleStep, (v) => updateSettings({ angleStep: v }), MIN_ANGLE_STEP, MAX_ANGLE_STEP, 1, (v) => `${v}°`)}
        {sliderControl('Cover scale', coverScale, (v) => updateSettings({ coverScale: v }), MIN_COVER_SCALE, MAX_COVER_SCALE, 0.05, (v) => `${Math.round(v * 100)}%`)}
        {sliderControl('Central album scale', centralAlbumScale, (v) => updateSettings({ centralAlbumScale: v }), MIN_CENTRAL_ALBUM_SCALE, MAX_CENTRAL_ALBUM_SCALE, 0.05, (v) => `${Math.round(v * 100)}%`)}
        
        {viewMode === 'plan' && (
          <>
            {sliderControl('Plan tilt', planViewTilt, (v) => updateSettings({ planViewTilt: v }), MIN_PLAN_VIEW_TILT, MAX_PLAN_VIEW_TILT, 1, (v) => `${v}°`)}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <Typography variant="caption" sx={{ color: 'white' }}>
                Center position:
              </Typography>
              <IconButton
                onClick={() => updateSettings({ planCenterAbove: !planCenterAbove })}
                aria-label={planCenterAbove ? 'Center above viewport' : 'Center below viewport'}
                sx={{
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' },
                }}
              >
                {planCenterAbove ? <ArrowCircleUp /> : <ArrowCircleDown />}
              </IconButton>
            </Box>
          </>
        )}
        
        {sliderControl('Perspective', perspective, (v) => updateSettings({ perspective: v }), MIN_PERSPECTIVE, MAX_PERSPECTIVE, 100, (v) => `${v}px`)}
        {sliderControl('Sensitivity', sensitivity, (v) => updateSettings({ sensitivity: v }), 0.05, 0.5, 0.01, (v) => v.toFixed(2))}
        {sliderControl('Radius', radius, (v) => updateSettings({ radius: v }), MIN_RADIUS, MAX_RADIUS, 100, (v) => v.toLocaleString())}
        {sliderControl('Damping', damping, (v) => updateSettings({ damping: v }), 0, 1, 0.01, (v) => v.toFixed(2))}
        {sliderControl('Spring strength', springStrength, (v) => updateSettings({ springStrength: v }), 0, 1, 0.01, (v) => v.toFixed(2))}
      </Box>
      )}
    </div>
  )
}
