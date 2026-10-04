import { CHAPTER_INDEX } from '@/components/copy'
import { SCENES } from '@/config/scenes'
import { engineer } from '@/config/content'

/**
 * The accessible HTML equivalent.
 *
 * context.txt: "Provide readable HTML equivalents for important text. Do not
 * place essential information only inside WebGL."
 *
 * The visible overlay only ever shows one chapter's copy at a time — which is
 * correct for the experience and useless to a screen reader navigating linearly,
 * or to a crawler. So the whole fourteen-chapter index is also rendered here,
 * visually hidden but fully present in the accessibility tree, ahead of the
 * visual layer.
 *
 * `sr-only` keeps it out of the visual design while leaving it readable to
 * assistive technology. Nothing here is `display: none` or `aria-hidden`.
 */
export function A11yContent() {
  return (
    <div className="sr-only">
      <h1>
        {engineer.name} — {engineer.role}
      </h1>
      <p>{engineer.summary}</p>
      <p>{engineer.specialisation}</p>

      <h2>Chapter index</h2>
      <ol>
        {CHAPTER_INDEX.map((chapter) => (
          <li key={chapter.id}>
            {chapter.id} — {chapter.heading} ({chapter.eyebrow}). {chapter.intent}
          </li>
        ))}
      </ol>

      <p>
        This portfolio is presented as {SCENES.length} scroll-driven scenes with an interactive 3D layer. The chapters
        are, in order: {SCENES.map((scene) => scene.title).join(', ')}.
      </p>
    </div>
  )
}