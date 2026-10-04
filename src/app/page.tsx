import { ExperienceShell } from '@/components/ExperienceShell'
import { A11yContent } from '@/components/A11yContent'

/**
 * The page.
 *
 * A Server Component. The accessible content index renders here, on the server,
 * so the portfolio has real text in the initial HTML; the interactive experience
 * is loaded separately on the client.
 */
export default function Home() {
  return (
    <>
      <A11yContent />
      <ExperienceShell />
    </>
  )
}