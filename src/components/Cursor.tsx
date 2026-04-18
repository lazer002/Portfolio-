'use client'
import { useEffect } from 'react'

export default function Cursor() {
  useEffect(() => {
    const cursor = document.createElement('div')
    cursor.style.position = 'fixed'
    cursor.style.width = '50px'
    cursor.style.height = '50px'
    cursor.style.border = '2px solid cyan'
    cursor.style.borderRadius = '50%'
    cursor.style.pointerEvents = 'none'
    cursor.style.zIndex = '9999'

    document.body.appendChild(cursor)

    window.addEventListener('mousemove', (e) => {
      cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
    })
  }, [])

  return null
}