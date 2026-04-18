'use client'

import Scene from '@/components/Scene'
import SmoothScroll from '@/components/SmoothScroll'
import Cursor from '@/components/Cursor'
import { motion } from 'framer-motion'

export default function Page() {
  return (
    <main className="bg-black text-white">
      <SmoothScroll />
      <Cursor />

      {/* HERO */}
      <section id="hero" className="h-screen relative">
        <Scene />

        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-7xl font-bold">INSANE</h1>
        </div>
      </section>

      {/* TEXT */}
      <section className="h-screen flex items-center px-20">
        <motion.h2
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="text-6xl font-bold"
        >
          CREATIVE DIGITAL EXPERIENCES
        </motion.h2>
      </section>

      {/* WORK */}
      <section className="h-[200vh]">
        <div className="sticky top-0 flex gap-10 h-screen items-center px-10">
          {[1,2,3].map(i => (
            <div key={i} className="w-80 h-96 bg-white/10 rounded-2xl" />
          ))}
        </div>
      </section>
    </main>
  )
}