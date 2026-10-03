'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'

type Project = {
  name: string
  description: string
  stack: string[]
  link?: string
}

const projects: Project[] = [
  {
    name: 'Nicobar E-commerce Platform',
    description:
      'Backend services behind a live D2C storefront — full order lifecycle across checkout, fulfillment, cancellations, returns, exchanges and gift cards. Event-driven SQS FIFO processing keeps Shopify and ERP state in sync.',
    stack: ['Node.js', 'Moleculer', 'Shopify', 'GraphQL', 'AWS SQS', 'Redis', 'MongoDB'],
    link: 'https://www.nicobar.com',
  },
  {
    name: 'Shopify Integration App',
    description:
      'Custom Shopify app bridging storefront, backend and ERP. Webhook-driven ingestion with signature verification, idempotent handlers and queue-based retries; rate-limit aware Admin API (REST + GraphQL) operations.',
    stack: ['Node.js', 'Shopify Admin API', 'Webhooks', 'AWS SQS', 'Redis', 'MongoDB'],
  },
  {
    name: 'Plexify Wealth App',
    description:
      'Cross-platform mobile app for insurance, bonds, property and wealth management — including a will-generation system. Built with React Native + Realm, integrated with Hedera blockchain for sensitive financial data.',
    stack: ['React Native', 'Realm', 'SQL', 'Tailwind CSS', 'Hedera'],
    link: 'https://plexifygroup.com',
  },
  {
    name: 'HR Management System',
    description:
      'Multi-role HRMS with Employee, Manager, Admin and HR logins, role-scoped access control, dynamic routing and login hierarchy. 95% admin-panel customization.',
    stack: ['MySQL', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    link: 'https://hr.manthanitsolutions.com',
  },
  {
    name: 'Honda HMSI Web & App',
    description:
      'Nationwide login hierarchy for thousands of users with dynamic, multi-level routing on OracleDB. Business-critical workflows for Honda two-wheelers.',
    stack: ['OracleDB', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    link: 'https://sampark.honda2wheelersindia.com',
  },
  {
    name: 'Zoro.PC',
    description:
      'E-commerce store for PCs and accessories — dynamic products, banners, add-to-cart and login hierarchy with 95% admin-panel customization.',
    stack: ['MySQL', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    link: 'https://zoropc-ms59.onrender.com',
  },
  {
    name: 'Urban-Zoro',
    description:
      'Contemporary clothing store for men and women with dynamic catalog and 80% admin-panel customization.',
    stack: ['MongoDB', 'Node.js', 'Express', 'Bootstrap', 'AJAX'],
    link: 'https://urbanzoro.onrender.com',
  },
]

export default function Work() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState(0)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const x = useTransform(scrollYProgress, [0, 1], [0, -range])

  // measure how far the track must travel so the last card lands in view
  useEffect(() => {
    const measure = () => {
      if (!trackRef.current) return
      const overflow = trackRef.current.scrollWidth - window.innerWidth
      setRange(Math.max(overflow + 80, 0)) // 80px right padding breathing room
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <section ref={sectionRef} id="work" className="relative h-[400vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
        {/* header */}
        <div className="px-10 mb-10 flex items-end justify-between">
          <div>
            <p className="text-cyan-400 text-xs tracking-[0.4em] font-mono mb-3">
              ▚ SELECTED WORK
            </p>
            <h2 className="text-5xl md:text-7xl font-bold leading-none">
              THINGS I&apos;VE <span className="text-cyan-400">BUILT</span>
            </h2>
          </div>
          <p className="hidden md:block text-white/40 font-mono text-sm">
            {String(projects.length).padStart(2, '0')} PROJECTS
          </p>
        </div>

        {/* horizontal track */}
        <motion.div
          ref={trackRef}
          style={{ x }}
          className="flex gap-8 pl-10 pr-10 w-max items-stretch"
        >
          {projects.map((project, i) => (
            <article
              key={project.name}
              className="group relative w-[min(420px,85vw)] shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 flex flex-col transition-all duration-300 hover:border-cyan-400/60 hover:bg-white/10 hover:-translate-y-2"
            >
              {/* index */}
              <span className="absolute top-6 right-7 font-mono text-5xl font-bold text-white/10 group-hover:text-cyan-400/30 transition-colors">
                {String(i + 1).padStart(2, '0')}
              </span>

              <h3 className="text-2xl font-bold leading-tight pr-14 mb-4">
                {project.name}
              </h3>

              <p className="text-sm text-white/60 leading-relaxed mb-6 flex-1">
                {project.description}
              </p>

              {/* stack chips */}
              <div className="flex flex-wrap gap-2 mb-6">
                {project.stack.map(tech => (
                  <span
                    key={tech}
                    className="text-[11px] font-mono px-2.5 py-1 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-cyan-300/80"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {/* link */}
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  VISIT LIVE
                  <span className="inline-block transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </a>
              )}
            </article>
          ))}

          {/* end card */}
          <div className="w-[min(320px,70vw)] shrink-0 rounded-2xl border border-dashed border-cyan-400/20 flex flex-col items-center justify-center text-center p-8">
            <p className="font-mono text-cyan-400/60 text-sm tracking-[0.3em] mb-3">
              MORE SOON
            </p>
            <p className="text-white/40 text-sm">
              Shopify apps, ERP pipelines & everything in between.
            </p>
          </div>
        </motion.div>

        {/* progress bar */}
        <div className="mx-10 mt-12 h-px bg-white/10 relative overflow-hidden">
          <motion.div
            style={{ scaleX: scrollYProgress }}
            className="absolute inset-0 bg-cyan-400 origin-left"
          />
        </div>
      </div>
    </section>
  )
}
