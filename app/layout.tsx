import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CarouselProvider } from '@/contexts/CarouselContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Record Circle - Music Player',
  description: 'A modern music player with 3D carousel interface',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CarouselProvider>
          {children}
        </CarouselProvider>
      </body>
    </html>
  )
}
