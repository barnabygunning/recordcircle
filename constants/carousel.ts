/**
 * Carousel configuration constants
 */

// Carousel geometry
export const MAX_VISIBLE = 25 // Show ~25 albums to cover -24° to +24° range
export const MIN_ANGLE = -45
export const MAX_ANGLE = 45
export const DEFAULT_ANGLE_STEP = 8 // Default angular spacing between adjacent albums
export const MIN_ANGLE_STEP = 1
export const MAX_ANGLE_STEP = 3

// Radius settings
export const DEFAULT_RADIUS = 8000 // Default radius for trigonometric positioning
export const MIN_RADIUS = 2000
export const MAX_RADIUS = 10000

// Cover art settings
export const DEFAULT_COVER_SCALE = 1.0 // Default cover art scaling factor (100% of viewport)
export const MIN_COVER_SCALE = 0.1 // Minimum cover art scaling factor (10% of viewport)
export const MAX_COVER_SCALE = 2.0 // Maximum cover art scaling factor (100% of viewport)

// Physics settings
export const DEFAULT_DAMPING = 0.4 // Default damping coefficient (0.0 = no damping, 1.0 = immediate stop)
export const DEFAULT_SPRING_STRENGTH = 0.9 // Default spring strength (0.0 = no spring, 1.0 = maximum)
export const MIN_VELOCITY = 0.1 // Stop when velocity is below this threshold (degrees per second)
export const SNAP_THRESHOLD = 0.05 // Snap to target when within this threshold (degrees)
export const SENSITIVITY = 0.15 // Degrees per pixel
export const FRAME_RATE = 60 // Target frame rate for calculations

// Interaction settings
export const DRAG_THRESHOLD = 100 // Pixels - below this is a "push" (momentum), above is a "drag" (direct control)

// Debug UI
export const DEBUGGER_VISIBLE = false // Show/hide debug UI overlay (rotation angle display and sliders)
