import { Chapter01 } from '@/components/chapters/Chapter01'
import { Chapter02 } from '@/components/chapters/Chapter02'
import { Chapter03 } from '@/components/chapters/Chapter03'
import { Chapter04 } from '@/components/chapters/Chapter04'
import { Chapter05 } from '@/components/chapters/Chapter05'
import { Chapter06 } from '@/components/chapters/Chapter06'
import { Chapter07 } from '@/components/chapters/Chapter07'
import { Chapter08 } from '@/components/chapters/Chapter08'
import { Chapter09 } from '@/components/chapters/Chapter09'
import { Chapter10 } from '@/components/chapters/Chapter10'
import { Chapter11 } from '@/components/chapters/Chapter11'
import { Chapter12 } from '@/components/chapters/Chapter12'
import { Chapter13 } from '@/components/chapters/Chapter13'
import { Chapter14 } from '@/components/chapters/Chapter14'
import type { Chapter } from '@/components/chapters/types'

/**
 * Chapter registry.
 *
 * Index order matches `SCENES` in `config/scenes`. Keeping the mapping in one
 * table means a chapter can be swapped, stubbed or removed without touching the
 * host, and the host never has to know how many there are.
 */
export const CHAPTERS: Chapter[] = [
  Chapter01,
  Chapter02,
  Chapter03,
  Chapter04,
  Chapter05,
  Chapter06,
  Chapter07,
  Chapter08,
  Chapter09,
  Chapter10,
  Chapter11,
  Chapter12,
  Chapter13,
  Chapter14,
]