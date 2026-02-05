'use client'

import { useState, useEffect } from 'react'
import { TextField, IconButton } from '@mui/material'
import { Search, Person, Settings } from '@mui/icons-material'
import AlbumCarousel from '@/components/AlbumCarousel'
import { albums } from '@/data/albums'
import { useCarousel } from '@/contexts/CarouselContext'
import styles from './page.module.css'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const { settingsVisible, updateSettings } = useCarousel()

  // Prevent page-level scrolling; lock layout for mobile
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.position = 'fixed'

    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.style.position = ''
    }
  }, [])

  // Safari: encourage toolbar to hide on load and first interaction
  useEffect(() => {
    const hideToolbar = () => window.scrollTo(0, 1)
    hideToolbar()
    window.addEventListener('touchstart', hideToolbar, { passive: true })
    window.addEventListener('click', hideToolbar, { once: true })
    return () => window.removeEventListener('touchstart', hideToolbar)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImage} />
      
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <IconButton
            onClick={() => updateSettings({ settingsVisible: !settingsVisible })}
            aria-label="Toggle carousel settings"
            sx={{
              color: 'white',
              backgroundColor: settingsVisible ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' },
            }}
          >
            <Settings />
          </IconButton>
          <IconButton 
            className={styles.userButton}
            sx={{ 
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.2)' }
            }}
          >
            <Person />
          </IconButton>
        </div>
        
        <TextField
          className={styles.searchField}
          placeholder="Search..."
          variant="outlined"
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ color: 'white', mr: 1 }} />,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: 'white',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '& fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.3)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.5)',
              },
              '&.Mui-focused fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.7)',
              },
            },
          }}
        />
      </div>

      <div className={styles.carouselContainer}>
        <AlbumCarousel albums={albums} />
      </div>
    </div>
  )
}
