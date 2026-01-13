'use client'

import { useState } from 'react'
import { TextField, IconButton } from '@mui/material'
import { Search, Person } from '@mui/icons-material'
import AlbumCarousel from '@/components/AlbumCarousel'
import { albums } from '@/data/albums'
import styles from './page.module.css'

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImage} />
      
      <div className={styles.header}>
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
