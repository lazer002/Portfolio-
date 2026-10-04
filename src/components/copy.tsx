import type { ReactNode } from 'react'

import { certification, contact, engineer, projects, roles, skills } from '@/config/content'
import { SCENES } from '@/config/scenes'

/**
 * Every word the portfolio says.
 *
 * This is the DOM layer the brief asks for: "Provide readable HTML equivalents
 * for important text. Do not place essential information only inside WebGL."
 * The 3D layer carries atmosphere and structure; this carries the content.
 *
 * The rule throughout: text here either comes from `config/content` (which holds
 * only resume-verified facts) or from context.txt's own "EXACT CONTENT TO SHOW"
 * lists. Nothing is invented — no metrics, no client names, no awards, no
 * technologies the resume does not list.
 */

export interface ChapterCopy {
  /** The chapter's display heading. */
  heading: string
  /** The chapter's body copy. */
  Body: (props: { reduced: boolean }) => ReactNode
}

/** Small uppercase technical label group — used wherever context.txt lists one. */
function Labels({ items }: { items: string[] }) {
  return (
    <ul className="labels">
      {items.map((item) => (
        <li key={item} className="labels__item">
          {item}
        </li>
      ))}
    </ul>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="chapter-copy__lead">{children}</p>
}

/** Projects with a real URL render as links; those without render as plain rows. */
function ProjectList({ ids }: { ids: string[] }) {
  return (
    <ul className="projects">
      {ids.map((id) => {
        const project = projects.find((p) => p.id === id)
        if (!project) return null
        const body = (
          <>
            <span className="projects__name">{project.name}</span>
            <span className="projects__stack">{project.stack.join(' · ')}</span>
            <span className="projects__description">{project.description}</span>
          </>
        )
        return (
          <li key={id} className="projects__item">
            {project.href ? (
              <a className="projects__link" href={project.href} target="_blank" rel="noopener noreferrer">
                {body}
                <span className="projects__cta">Open project ↗</span>
              </a>
            ) : (
              <div className="projects__link">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export const CHAPTER_COPY: ChapterCopy[] = [
  {
    heading: 'The Neon Core',
    Body: () => (
      <>
        <h3 className="identity">
          {engineer.name.toUpperCase()}
        </h3>
        <p className="identity__role">{engineer.role.toUpperCase()}</p>
        <p className="identity__tagline">{engineer.tagline.toUpperCase()}</p>
        <p className="identity__years">{engineer.experienceYears.toUpperCase()}</p>
        <Lead>{engineer.summary}</Lead>
      </>
    ),
  },
  {
    heading: 'Engineer Profile',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">BACKEND-FOCUSED SOFTWARE ENGINEER</p>
        <Labels items={['Node.js', 'Express.js', 'Moleculer']} />
        <Labels items={['REST', 'GraphQL', 'Microservices']} />
        <Labels items={['Production debugging', 'scalable systems', 'integrations']} />
        <Lead>{engineer.specialisation}</Lead>
        <div className="timeline">
          {roles.map((role) => (
            <div key={role.company} className="timeline__row">
              <span className="timeline__period">{role.period}</span>
              <span className="timeline__company">{role.company}</span>
              <span className="timeline__title">
                {role.title}
                {role.current ? <span className="timeline__current">CURRENT</span> : null}
              </span>
            </div>
          ))}
          <div className="timeline__row">
            <span className="timeline__period">{certification.period}</span>
            <span className="timeline__company">Certification</span>
            <span className="timeline__title">{certification.title}</span>
          </div>
        </div>
      </>
    ),
  },
  {
    heading: 'Microservice City',
    Body: () => (
      <>
        <Labels
          items={[
            'Microservices',
            'Node.js',
            'Express.js',
            'Moleculer',
            'REST APIs',
            'GraphQL',
            'Asynchronous processing',
            'Webhooks',
            'Idempotency',
            'Retry workflows',
          ]}
        />
        <Lead>
          Architecture expressed as a working city: every tower is a service, every packet is a request. Requests
          travel from an API gateway to the service that owns the work, then onward to cache, database and queue
          nodes — never in a straight line, always along a curved path.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Commerce Machine',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">NICOBAR E-COMMERCE PLATFORM</p>
        <Labels
          items={[
            'Checkout',
            'Fulfillment',
            'Cancellation',
            'Returns',
            'Exchanges',
            'Gift cards',
            'Shopify',
            'ERP',
            'Redis',
            'MongoDB',
          ]}
        />
        <ProjectList ids={['nicobar']} />
        <Lead>
          One order packet, followed end to end: a scanner gate at checkout, order processing, internal inventory and
          payment routes, a fulfilment conveyor, and then the branches — cancellation, return, exchange and
          settlement.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Event Rail',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">EVENT-DRIVEN PROCESSING</p>
        <Labels
          items={[
            'AWS SQS',
            'FIFO queues',
            'Ordered delivery',
            'Deduplication',
            'Delay queues',
            'Retry',
            'Backoff',
            'Dead-letter queues',
          ]}
        />
        <Lead>
          Ordered delivery, a duplicate rejected at the deduplication gate, a failure entering a delay chamber, and a
          retry that travels a visibly larger loop each time before the event finally drops into the dead-letter
          chamber. Backoff is shown as distance, because that is what backoff is.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Shopify Nexus',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">SHOPIFY ADMIN API</p>
        <Labels
          items={[
            'REST',
            'GraphQL',
            'Webhooks',
            'Signature verification',
            'Idempotent handlers',
            'Rate-limit aware requests',
            'Product',
            'Inventory',
            'Order',
            'Gift card',
          ]}
        />
        <ProjectList ids={['shopify-app']} />
        <Lead>
          REST and GraphQL leave the gateway on separate paths and never merge. Webhooks arrive from outside as signed
          capsules, pass signature verification, enter an idempotency lock, and join the queue. When the request rate
          rises the client spaces its calls rather than flooding — rate-limit awareness, shown as spacing.
        </Lead>
      </>
    ),
  },
  {
    heading: 'ERP Bridge',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">ERP INTEGRATION</p>
        <Labels
          items={[
            'SOAP APIs',
            'SOAP UI',
            'Postman',
            'Payload debugging',
            'Order status synchronization',
          ]}
        />
        <Lead>
          Two systems facing each other across a gap. A payload crosses from commerce to ERP and a response returns
          the other way. A scanning beam walks the data ribbon, briefly flagging malformed segments before the
          corrected, synchronized packet crosses cleanly.
        </Lead>
        <p className="chapter-copy__note">
          The flagged segments are illustrative geometry, not a recorded incident.
        </p>
      </>
    ),
  },
  {
    heading: 'Data Vault',
    Body: () => (
      <>
        <Labels
          items={[
            'MongoDB',
            'MySQL',
            'OracleDB',
            'Redis',
            'Caching',
            'Workflow state',
            'Transactional data',
            'Query performance',
          ]}
        />
        <Lead>
          Four stores drawn as the shape of their data: loose document shards, a rigid relational grid, an immovable
          enterprise vault, and a thin fast memory layer sitting closest to the request path. A request checks Redis
          first; on a miss it travels to the persistent layer, and the response populates the cache on the way back.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Product Gallery',
    Body: () => (
      <>
        <ProjectList ids={projects.map((p) => p.id)} />
        <Lead>
          The projects themselves, as slabs you walk past. The commerce work carries more motion than the supporting
          builds, because it is where the load is.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Mobile Wealth Node',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">PLEXIFY WEALTH APP</p>
        <Labels
          items={[
            'React Native',
            'Insurance',
            'Bonds',
            'Property',
            'User assets',
            'Wealth management',
            'Will generation',
            'Realm',
            'Hedera blockchain',
          ]}
        />
        <ProjectList ids={['plexify']} />
        <Lead>
          A React Native app for insurance, bonds, property and wealth management, including will generation, with
          sensitive financial data handled through Hedera. The lattice behind the device only pulses when data
          actually moves between the app and the secure-data layer.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Access Grid',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">HR MANAGEMENT SYSTEM</p>
        <Labels
          items={[
            'Employee',
            'Manager',
            'Admin',
            'HR',
            'Honda HMSI',
            'OracleDB',
            'Dynamic routing',
            'Multi-level login hierarchy',
          ]}
        />
        <ProjectList ids={['hrms', 'honda']} />
        <Lead>
          Role-based access, made vertical. The camera climbs the tower and each level unlocks the layer above it,
          while the user nodes sit below as the population the hierarchy governs.
        </Lead>
      </>
    ),
  },
  {
    heading: 'Control Room',
    Body: () => (
      <>
        <p className="chapter-copy__kicker">PRODUCTION DEBUGGING</p>
        <Labels
          items={[
            'Log analysis',
            'API payload tracing',
            'Database records',
            'Queue behavior',
            'UAT incidents',
            'Root-cause analysis',
            'Production safeguards',
          ]}
        />
        <Lead>
          The method, not a war story: log, then payload, then queue state, then the record, then root cause, then
          the corrected workflow. The failed request stays frozen in the centre of the room while everything around
          it moves.
        </Lead>
        <p className="chapter-copy__note">
          The diagnostics shown are clearly illustrative. No specific production incident is claimed, because the
          resume does not document one.
        </p>
      </>
    ),
  },
  {
    heading: 'Stack Matrix',
    Body: () => (
      <>
        <Labels items={skills.map((skill) => skill.name)} />
        <Lead>
          Every technology in the resume, placed in one system map: backend technologies in the central cluster,
          integrations in the middle ring, interface technologies on the outside — connected by the relationships
          they actually have. {skills.length} skills, and no gaps filled for symmetry.
        </Lead>
      </>
    ),
  },
  {
    heading: 'The Core',
    Body: () => (
      <>
        <h3 className="identity">{engineer.name.toUpperCase()}</h3>
        <p className="identity__role">{engineer.role.toUpperCase()}</p>
        <p className="identity__tagline">{engineer.closing.toUpperCase()}</p>
        <div className="contact">
          {contact.map((channel) =>
            channel.href ? (
              <a key={channel.id} className="contact__action" href={channel.href} target="_blank" rel="noopener noreferrer">
                {channel.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            ) : (
              <span key={channel.id} className="contact__action contact__action--disabled" aria-disabled="true">
                {channel.label}
              </span>
            ),
          )}
        </div>
        <p className="chapter-copy__note">
          The resume supplied these channel names without URLs, so none are linked here rather than guessed.
        </p>
      </>
    ),
  },
]

/** A compact index of every chapter, used by the accessible HTML equivalent. */
export const CHAPTER_INDEX = SCENES.map((scene, i) => ({
  id: scene.id,
  title: scene.title,
  eyebrow: scene.eyebrow,
  intent: scene.intent,
  heading: CHAPTER_COPY[i]?.heading ?? scene.title,
}))