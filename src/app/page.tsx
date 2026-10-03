'use client'

import Scene from '@/components/Scene'
import SmoothScroll from '@/components/SmoothScroll'
import Cursor from '@/components/Cursor'
import Work from '@/components/Work'
import { motion } from 'framer-motion'

export default function Page() {
  return (
    <main id="container" className="h-[500vh] bg-black text-white">
      <SmoothScroll />
      <Cursor />

      {/* HERO */}
      <section id="hero" className="h-screen sticky top-0">
        <Scene />

 
      </section>

      {/* 🧠 IDENTITY SECTION (NEW — IMPORTANT) */}
      <section className="h-screen sticky top-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">

          <motion.h1
            initial={{ opacity: 0, y: 100 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2 }}
            className="text-[10vw] font-bold leading-none"
          >
            LAZER
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.7 }}
            transition={{ delay: 0.3 }}
            className="text-xl mt-4"
          >
            CREATIVE SOFTWARE ENGINEER
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 0.4 }}
            transition={{ delay: 0.6 }}
            className="text-sm mt-2"
          >
            aka Ajit
          </motion.p>

        </div>
      </section>

      {/* 💼 WORK */}
      <Work />
    </main>
  )
}