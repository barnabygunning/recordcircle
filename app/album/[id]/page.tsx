'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { IconButton } from '@mui/material'
import { PlayArrow, Pause, SkipNext, SkipPrevious, ArrowBack } from '@mui/icons-material'
import { albums } from '@/data/albums'
import { getAlbumImagePath, getAlbumImageSrcSet, parseAlbumFilename } from '@/utils/imageUtils'
import styles from './page.module.css'

export default function AlbumPage() {
  const params = useParams()
  const router = useRouter()
  const albumId = parseInt(params.id as string)
  const album = albums.find(a => a.id === albumId)
  const [isPlaying, setIsPlaying] = useState(false)
  const totalAlbums = albums.length

  useEffect(() => {
    if (!album) {
      router.push('/')
    }
  }, [album, router])

  if (!album) {
    return null
  }

  const { artist, title } = parseAlbumFilename(album.filename)

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const handleNext = () => {
    const nextId = albumId < totalAlbums ? albumId + 1 : 1
    router.push(`/album/${nextId}`)
  }

  const handlePrevious = () => {
    const prevId = albumId > 1 ? albumId - 1 : totalAlbums
    router.push(`/album/${prevId}`)
  }

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImage} />
      
      <div className={styles.backButton}>
        <IconButton
          onClick={() => router.push('/')}
          sx={{
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
          }}
        >
          <ArrowBack />
        </IconButton>
      </div>
      
      <div className={styles.content}>
        <div className={styles.albumArtContainer}>
          <img
            src={getAlbumImagePath(album.filename, 3)}
            alt={title}
            className={styles.albumArt}
            srcSet={getAlbumImageSrcSet(album.filename)}
            width={600}
            height={600}
          />
        </div>

        <div className={styles.playerControls}>
          <IconButton
            className={styles.controlButton}
            onClick={handlePrevious}
            sx={{
              width: 64,
              height: 64,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            <SkipPrevious sx={{ fontSize: 32 }} />
          </IconButton>

          <IconButton
            className={styles.controlButton}
            onClick={handlePlayPause}
            sx={{
              width: 80,
              height: 80,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.4)',
              },
            }}
          >
            {isPlaying ? (
              <Pause sx={{ fontSize: 40 }} />
            ) : (
              <PlayArrow sx={{ fontSize: 40 }} />
            )}
          </IconButton>

          <IconButton
            className={styles.controlButton}
            onClick={handleNext}
            sx={{
              width: 64,
              height: 64,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            <SkipNext sx={{ fontSize: 32 }} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}
