/**
 * Get the image path for a given album filename and resolution
 * @param filename - The base filename (without @1x, @2x, @3x suffix)
 * @param resolution - The resolution multiplier (1, 2, or 3)
 * @returns The full path to the image
 */
export function getAlbumImagePath(filename: string, resolution: 1 | 2 | 3 = 1): string {
  return `/album-covers/@${resolution}x/${filename}@${resolution}x.jpg`
}

/**
 * Get image srcSet for responsive images
 * @param filename - The base filename (without @1x, @2x, @3x suffix)
 * @returns srcSet string for Next.js Image component
 */
export function getAlbumImageSrcSet(filename: string): string {
  const path1x = getAlbumImagePath(filename, 1)
  const path2x = getAlbumImagePath(filename, 2)
  const path3x = getAlbumImagePath(filename, 3)
  return `${path1x} 1x, ${path2x} 2x, ${path3x} 3x`
}

/**
 * Parse album filename to extract artist and title
 * @param filename - The base filename (e.g., "angelolsen_allmirrors")
 * @returns Object with artist and title
 */
export function parseAlbumFilename(filename: string): { artist: string; title: string } {
  // Try to split on underscore - assumes format: artist_albumtitle
  const parts = filename.split('_')
  if (parts.length >= 2) {
    const artist = parts[0].replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
    const title = parts.slice(1).join(' ').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
    return { artist, title }
  }
  // Fallback: just use the filename
  return { artist: 'Unknown Artist', title: filename.replace(/_/g, ' ') }
}
