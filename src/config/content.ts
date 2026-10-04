/**
 * Every fact the portfolio is allowed to say.
 *
 * context.txt is explicit: "Do not invent employment history, projects, metrics,
 * clients, awards or technologies." This module is the only place factual content
 * lives, and scenes import from here rather than hard-coding strings. If a fact is
 * not in this file, it does not exist on screen.
 *
 * Anything a visualisation needs that the resume does not supply (a queue depth, a
 * sequence number, a payload shape) is illustrative and lives in the scene files,
 * clearly labelled — never mixed in here.
 */

export const engineer = {
  name: 'Ajit Kumar',
  role: 'Software Engineer',
  /** SCENE 01 — THE NEON CORE */
  tagline: 'Backend · Microservices · E-commerce · Event-driven systems',
  experienceYears: '4+ years experience',
  summary:
    'Backend-focused software engineer building and scaling Node.js services for high-volume e-commerce and enterprise platforms.',
  specialisation:
    'Shopify and ERP integrations, event-driven order processing, AWS SQS FIFO queues, REST and GraphQL APIs, production debugging, and order, return and fulfilment workflows.',
  /** SCENE 14 — CONTACT */
  closing: 'Building scalable digital systems',
} as const

export interface Role {
  company: string
  title: string
  /** Human-readable, exactly as the resume states it. */
  period: string
  current: boolean
}

export const roles: Role[] = [
  {
    company: 'Nicobar Design Pvt. Ltd.',
    title: 'Software Engineer',
    period: 'March 2025 — Present',
    current: true,
  },
  {
    company: 'Plexify Global Ind Pvt Ltd',
    title: 'Software Developer',
    period: 'October 2024 — February 2025',
    current: false,
  },
  {
    company: 'Manthan IT Solutions',
    title: 'Node.js Developer',
    period: 'June 2023 — October 2024',
    current: false,
  },
]

export const certification = {
  title: 'Full Stack Developer',
  period: 'December 2022 — June 2023',
} as const

export interface Project {
  id: string
  name: string
  /** The resume's own framing of the work. */
  description: string
  stack: string[]
  /** Only present where the resume supplied a real URL. */
  href?: string
  /** Flagships carry the strongest motion in SCENE 09. */
  flagship: boolean
}

export const projects: Project[] = [
  {
    id: 'nicobar',
    name: 'Nicobar E-commerce Platform',
    description:
      'Backend services behind a live D2C storefront — full order lifecycle across checkout, fulfilment, cancellations, returns, exchanges and gift cards. Event-driven SQS FIFO processing keeps Shopify and ERP state in sync.',
    stack: ['Node.js', 'Moleculer', 'Shopify', 'GraphQL', 'AWS SQS', 'Redis', 'MongoDB'],
    href: 'https://www.nicobar.com',
    flagship: true,
  },
  {
    id: 'shopify-app',
    name: 'Shopify Integration App',
    description:
      'Custom Shopify app bridging storefront, backend and ERP. Webhook-driven ingestion with signature verification, idempotent handlers and queue-based retries; rate-limit aware Admin API (REST + GraphQL) operations.',
    stack: ['Node.js', 'Shopify Admin API', 'Webhooks', 'AWS SQS', 'Redis', 'MongoDB'],
    flagship: true,
  },
  {
    id: 'plexify',
    name: 'Plexify Wealth App',
    description:
      'Cross-platform mobile app for insurance, bonds, property and wealth management — including a will-generation system. Built with React Native and Realm, integrated with Hedera blockchain for sensitive financial data.',
    stack: ['React Native', 'Realm', 'SQL', 'Tailwind CSS', 'Hedera'],
    href: 'https://plexifygroup.com',
    flagship: true,
  },
  {
    id: 'hrms',
    name: 'Human Resource Management System',
    description:
      'Multi-role HRMS with Employee, Manager, Admin and HR logins, role-scoped access control, dynamic routing and login hierarchy. 95% admin-panel customization.',
    stack: ['MySQL', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    href: 'https://hr.manthanitsolutions.com',
    flagship: false,
  },
  {
    id: 'honda',
    name: 'Honda HMSI Web & App',
    description:
      'Nationwide login hierarchy for thousands of users with dynamic, multi-level routing on OracleDB. Business-critical workflows for Honda two-wheelers.',
    stack: ['OracleDB', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    href: 'https://sampark.honda2wheelersindia.com',
    flagship: false,
  },
  {
    id: 'zoro',
    name: 'Zoro.PC',
    description:
      'E-commerce store for PCs and accessories — dynamic products, banners, add-to-cart and login hierarchy with 95% admin-panel customization.',
    stack: ['MySQL', 'Node.js', 'Express', 'jQuery', 'Bootstrap'],
    href: 'https://zoropc-ms59.onrender.com',
    flagship: false,
  },
  {
    id: 'urban-zoro',
    name: 'Urban-Zoro',
    description:
      'Contemporary clothing store for men and women with dynamic catalog and 80% admin-panel customization.',
    stack: ['MongoDB', 'Node.js', 'Express', 'Bootstrap', 'AJAX'],
    href: 'https://urbanzoro.onrender.com',
    flagship: false,
  },
]

/** Where a skill sits in the SCENE 13 matrix — centre, middle ring, outer ring. */
export type SkillRing = 'core' | 'integration' | 'interface'

export interface Skill {
  id: string
  name: string
  ring: SkillRing
  /** Ids of skills that reinforce each other, drawn as matrix edges. */
  related: string[]
}

export const skills: Skill[] = [
  { id: 'node', name: 'Node.js', ring: 'core', related: ['express', 'moleculer', 'rest', 'graphql', 'sqs', 'socketio'] },
  { id: 'express', name: 'Express.js', ring: 'core', related: ['node', 'rest', 'graphql'] },
  { id: 'moleculer', name: 'Moleculer', ring: 'core', related: ['node', 'microservices', 'sqs'] },
  { id: 'graphql', name: 'GraphQL', ring: 'core', related: ['node', 'rest'] },
  { id: 'rest', name: 'REST', ring: 'core', related: ['node', 'express', 'graphql'] },
  { id: 'microservices', name: 'Microservices', ring: 'core', related: ['moleculer', 'node', 'sqs'] },
  { id: 'sqs', name: 'AWS SQS', ring: 'core', related: ['redis', 'moleculer', 'microservices'] },
  { id: 'mongo', name: 'MongoDB', ring: 'core', related: ['mysql', 'oracle', 'redis'] },
  { id: 'mysql', name: 'MySQL', ring: 'core', related: ['mongo', 'oracle'] },
  { id: 'oracle', name: 'OracleDB', ring: 'core', related: ['mysql', 'mongo'] },
  { id: 'redis', name: 'Redis', ring: 'core', related: ['sqs', 'mongo', 'socketio'] },
  { id: 'python', name: 'Python', ring: 'integration', related: ['rest', 'graphql'] },
  { id: 'javascript', name: 'JavaScript', ring: 'integration', related: ['node', 'react', 'jquery', 'ajax'] },
  { id: 'webhooks', name: 'Webhooks', ring: 'integration', related: ['rest', 'graphql', 'sqs'] },
  { id: 'socketio', name: 'Socket.io', ring: 'integration', related: ['redis', 'node'] },
  { id: 'sendgrid', name: 'SendGrid', ring: 'integration', related: ['webhooks'] },
  { id: 'moengage', name: 'MoEngage', ring: 'integration', related: ['webhooks'] },
  { id: 'firebase', name: 'Firebase', ring: 'integration', related: ['node'] },
  { id: 'soapui', name: 'SOAP UI', ring: 'integration', related: ['rest', 'postman'] },
  { id: 'postman', name: 'Postman', ring: 'integration', related: ['rest', 'graphql', 'soapui'] },
  { id: 'docker', name: 'Docker', ring: 'integration', related: ['node', 'moleculer'] },
  { id: 'git', name: 'Git', ring: 'integration', related: ['agile', 'docker'] },
  { id: 'agile', name: 'Agile / Scrum', ring: 'integration', related: ['git'] },
  { id: 'react', name: 'React', ring: 'interface', related: ['javascript', 'reactnative', 'tailwind', 'gsap'] },
  { id: 'reactnative', name: 'React Native', ring: 'interface', related: ['react', 'javascript'] },
  { id: 'gsap', name: 'GSAP', ring: 'interface', related: ['react', 'ajax'] },
  { id: 'tailwind', name: 'Tailwind CSS', ring: 'interface', related: ['react', 'bootstrap'] },
  { id: 'bootstrap', name: 'Bootstrap', ring: 'interface', related: ['jquery', 'tailwind'] },
  { id: 'jquery', name: 'jQuery', ring: 'interface', related: ['javascript', 'ajax', 'bootstrap'] },
  { id: 'ajax', name: 'AJAX', ring: 'interface', related: ['jquery', 'rest', 'javascript'] },
]

/**
 * SCENE 14 — CONTACT.
 *
 * The resume supplied names for these channels but no URLs, and context.txt
 * forbids inventing them. They render as labelled actions with `href: null`;
 * fill the URLs in here and every contact surface in the experience updates.
 */
export interface ContactChannel {
  id: string
  label: string
  href: string | null
}

export const contact: ContactChannel[] = [
  { id: 'linkedin', label: 'LinkedIn', href: null },
  { id: 'github', label: 'GitHub', href: null },
  { id: 'email', label: 'Email', href: null },
]