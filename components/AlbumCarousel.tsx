'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Slider, Box, Typography } from '@mui/material'
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
  DEFAULT_DAMPING,
  DEFAULT_SPRING_STRENGTH,
  MIN_VELOCITY,
  SNAP_THRESHOLD,
  SENSITIVITY,
  FRAME_RATE,
  DEBUGGER_VISIBLE,
} from '@/constants/carousel'
const MIN_ANGLE_STEP = 1
const MAX_ANGLE_STEP = 3

export default function AlbumCarousel({ albums }: AlbumCarouselProps) {
  const router = useRouter()
  const totalAlbums = albums.length
  const [viewportWidth, setViewportWidth] = useState(1920) // Default, will update
  const [radius, setRadius] = useState(DEFAULT_RADIUS) // Adjustable radius
  const [coverScale, setCoverScale] = useState(DEFAULT_COVER_SCALE) // Cover art scaling factor
  const [damping, setDamping] = useState(DEFAULT_DAMPING) // Damping coefficient (adjustable)
  const [springStrength, setSpringStrength] = useState(DEFAULT_SPRING_STRENGTH) // Spring strength (adjustable)
  const [debuggerVisible, setDebuggerVisible] = useState(DEBUGGER_VISIBLE) // Debugger UI visibility (toggleable with '=' key)
  
  // Calculate album size as viewportWidth * coverScale
  const albumSize = Math.floor(viewportWidth * coverScale)
  
  // Initialize visible albums: centered around index 0
  // Each album has a fixed baseAngle in the carousel
  const initializeVisibleAlbums = (): VisibleAlbum[] => {
    const visible: VisibleAlbum[] = []
    const centerIndex = 0
    // Calculate how many albums we need to cover the angle range
    const albumsNeeded = Math.ceil((MAX_ANGLE - MIN_ANGLE) / DEFAULT_ANGLE_STEP) + 1
    const halfVisible = Math.floor(albumsNeeded / 2)
    
    for (let i = -halfVisible; i <= halfVisible; i++) {
      const albumIndex = (centerIndex + i + totalAlbums) % totalAlbums
      const baseAngle = i * DEFAULT_ANGLE_STEP
      visible.push({
        album: albums[albumIndex],
        albumIndex,
        baseAngle,
      })
    }
    
    return visible
  }
  
  // Update viewport width on resize
  useEffect(() => {
    const updateViewportWidth = () => {
      setViewportWidth(window.innerWidth)
    }
    
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  // Keyboard event handler to toggle debugger visibility with '=' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Check if '=' key is pressed (also handles '+' without shift)
      if (e.key === '=' || e.key === '+') {
        setDebuggerVisible(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  const [visibleAlbums, setVisibleAlbums] = useState<VisibleAlbum[]>(initializeVisibleAlbums)
  const [carouselRotation, setCarouselRotation] = useState(0) // Global rotation of entire carousel
  
  // Initialize rotation ref
  useEffect(() => {
    currentRotationRef.current = carouselRotation
  }, [carouselRotation])
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [shouldAnimate, setShouldAnimate] = useState(false) // Trigger to start animation
  const [targetRotation, setTargetRotation] = useState(0) // Target rotation snapped to 2° increments
  const rotationVelocityRef = useRef(0) // Angular velocity in degrees per second (using ref to avoid re-renders)
  const currentRotationRef = useRef(0) // Track current rotation for spring physics
  const animationFrameRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number>(0) // Track time for frame-based calculations
  
  // Calculate target rotation snapped to nearest ANGLE_STEP increment
  const snapToAngleStep = (rotation: number): number => {
    return Math.round(rotation / DEFAULT_ANGLE_STEP) * DEFAULT_ANGLE_STEP
  }

  // Update carousel rotation and handle album replacement
  const updateCarouselRotation = useCallback((rotationDelta: number) => {
    setCarouselRotation(prev => {
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
        
        // Helper function to snap baseAngle to nearest multiple of DEFAULT_ANGLE_STEP
        const snapBaseAngle = (angle: number): number => {
          return Math.round(angle / DEFAULT_ANGLE_STEP) * DEFAULT_ANGLE_STEP
        }
        
        // Second pass: add new albums if needed to fill the range
        // If albums went too far left (rotating right), add previous album on the left
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
        } else if (leftmostInBounds && leftmostInBoundsAngle > MIN_ANGLE + DEFAULT_ANGLE_STEP) {
          // Proactively add album on left if we have room
          const prevIndex = (leftmostInBounds.albumIndex - 1 + totalAlbums) % totalAlbums
          const alreadyVisible = newAlbums.some(va => va.albumIndex === prevIndex)
          if (!alreadyVisible && newAlbums.length < MAX_VISIBLE) {
            newAlbums.unshift({
              album: albums[prevIndex],
              albumIndex: prevIndex,
              baseAngle: snapBaseAngle((leftmostInBoundsAngle - DEFAULT_ANGLE_STEP) - newRotation),
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
        } else if (rightmostInBounds && rightmostInBoundsAngle < MAX_ANGLE - DEFAULT_ANGLE_STEP) {
          // Proactively add album on right if we have room
          const nextIndex = (rightmostInBounds.albumIndex + 1) % totalAlbums
          const alreadyVisible = newAlbums.some(va => va.albumIndex === nextIndex)
          if (!alreadyVisible && newAlbums.length < MAX_VISIBLE) {
            newAlbums.push({
              album: albums[nextIndex],
              albumIndex: nextIndex,
              baseAngle: snapBaseAngle((rightmostInBoundsAngle + DEFAULT_ANGLE_STEP) - newRotation),
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
  }, [albums, totalAlbums])

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

  useEffect(() => {
    let lastX = startX
    let lastTime = Date.now()
    let velocityTracker: number[] = [] // Track recent velocities for smoothing

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const currentTime = Date.now()
      const deltaTime = currentTime - lastTime
      const deltaX = e.clientX - lastX
      
      if (deltaTime > 0) {
        // Calculate instantaneous velocity (degrees per second)
        // deltaX * SENSITIVITY gives degrees moved
        // deltaTime is in milliseconds, convert to seconds
        const instantVelocity = (deltaX * SENSITIVITY) / (deltaTime / 1000)
        velocityTracker.push(instantVelocity)
        
        // Keep only last 5 velocity samples for smoothing
        if (velocityTracker.length > 5) {
          velocityTracker.shift()
        }
        
        // Calculate average velocity (degrees per second)
        const avgVelocity = velocityTracker.reduce((a, b) => a + b, 0) / velocityTracker.length
        
        // Update rotation immediately during drag
        const rotationDelta = deltaX * SENSITIVITY
        updateCarouselRotation(rotationDelta)
        
        // Update velocity for when drag ends (store in ref as degrees per second)
        rotationVelocityRef.current = avgVelocity
      }
      
      lastX = e.clientX
      lastTime = currentTime
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      // Calculate target rotation based on current rotation, snapped to 2° increments
      setCarouselRotation(current => {
        const snappedTarget = snapToAngleStep(current)
        setTargetRotation(snappedTarget)
        return current
      })
      // Trigger animation - spring physics will pull toward target
      setShouldAnimate(true)
    }

    if (isDragging) {
      lastX = startX
      lastTime = Date.now()
      velocityTracker = []
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      // Stop tracking when not dragging
      velocityTracker = []
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, startX, updateCarouselRotation])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setStartX(e.clientX)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const currentTime = Date.now()
    const deltaX = e.touches[0].clientX - startX
    
    // Update rotation immediately during drag
    const rotationDelta = deltaX * SENSITIVITY
    updateCarouselRotation(rotationDelta)
    
    // Calculate velocity for momentum (simplified for touch)
    // Convert to degrees per second (assuming ~16ms per frame for touch)
    const touchVelocity = (rotationDelta * 0.5) * 60 // Scale and convert to per-second
    rotationVelocityRef.current = touchVelocity
    
    setStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    // Calculate target rotation based on current rotation, snapped to 2° increments
    setCarouselRotation(current => {
      const snappedTarget = snapToAngleStep(current)
      setTargetRotation(snappedTarget)
      return current
    })
    // Trigger animation - spring physics will pull toward target
    setShouldAnimate(true)
  }

  const handleAlbumClick = (albumId: number) => {
    if (!isDragging) {
      router.push(`/album/${albumId}`)
    }
  }

  return (
    <div className={styles.carouselContainer}>
      <div
        className={styles.carousel}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        {visibleAlbums.map((visibleAlbum) => {
          const { album, baseAngle } = visibleAlbum
          // Effective angle = baseAngle + carouselRotation
          const effectiveAngle = baseAngle + carouselRotation
          const absAngle = Math.abs(effectiveAngle)
          
          // Fixed size - no scaling
          const size = albumSize
          
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
          
          // Rotate album about vertical axis to face center
          // Albums rotate by -effectiveAngle to face forward
          const rotationY = -effectiveAngle
          
          // Z-index: center album (absAngle = 0) should be highest
          // Higher z-index = appears on top
          const zIndex = Math.round(1000 + (MAX_ANGLE - absAngle) * 10)

          return (
            <div
              key={`${album.id}-${visibleAlbum.albumIndex}`}
              className={styles.albumItem}
              style={{
                transform: `translate3d(${xOffset}px, 0, ${zOffset}px) rotateY(${rotationY}deg)`,
                opacity,
                zIndex,
                width: `${size}px`,
                height: `${size}px`,
                marginLeft: `-${size / 2}px`,
                marginTop: `-${size / 2}px`,
              }}
              onClick={() => handleAlbumClick(album.id)}
            >
              <div className={styles.albumImageContainer}>
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
      
      {/* Debug UI Controls */}
      {debuggerVisible && (
      <Box
        sx={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '1.5rem 2rem',
          borderRadius: '12px',
          zIndex: 1000,
          minWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <Typography
          variant="body1"
          sx={{
            color: 'white',
            textAlign: 'center',
            fontWeight: 'bold',
          }}
        >
          Rotation: {carouselRotation.toFixed(2)}°
        </Typography>
        
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            Radius: {radius.toLocaleString()}
          </Typography>
          <Slider
            value={radius}
            onChange={(_, value) => setRadius(value as number)}
            min={MIN_RADIUS}
            max={MAX_RADIUS}
            step={100}
            sx={{
              color: 'white',
              '& .MuiSlider-thumb': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-track': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-rail': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
        </Box>
        
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            Cover Scale: {coverScale.toFixed(2)}
          </Typography>
           <Slider
             value={coverScale}
             onChange={(_, value) => setCoverScale(value as number)}
             min={MIN_COVER_SCALE}
             max={MAX_COVER_SCALE}
             step={0.05}
            sx={{
              color: 'white',
              '& .MuiSlider-thumb': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-track': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-rail': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
        </Box>
        
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            Damping: {damping.toFixed(2)}
          </Typography>
          <Slider
            value={damping}
            onChange={(_, value) => setDamping(value as number)}
            min={0.0}
            max={1.0}
            step={0.01}
            sx={{
              color: 'white',
              '& .MuiSlider-thumb': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-track': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-rail': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
        </Box>
        
        <Box sx={{ width: '100%' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              display: 'block',
              marginBottom: '0.5rem',
            }}
          >
            Spring Strength: {springStrength.toFixed(2)}
          </Typography>
          <Slider
            value={springStrength}
            onChange={(_, value) => setSpringStrength(value as number)}
            min={0.0}
            max={1.0}
            step={0.01}
            sx={{
              color: 'white',
              '& .MuiSlider-thumb': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-track': {
                backgroundColor: 'white',
              },
              '& .MuiSlider-rail': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          />
        </Box>
      </Box>
      )}
    </div>
  )
}
