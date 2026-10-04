/**
 * Minimal PNG decoder, enough to measure a screenshot.
 *
 * Reading pixels back with `gl.readPixels` does NOT work for this app: the
 * renderer runs with `preserveDrawingBuffer: false`, so the drawing buffer is
 * gone once the frame has been composited and readPixels returns all zeros. That
 * produced a "mean luminance 0" reading for a scene that was merely dark —
 * a measurement bug that looked exactly like a rendering bug.
 *
 * The screenshot is the compositor's own output, so it is the only trustworthy
 * source of truth for "is anything actually visible". This decodes it.
 *
 * Handles 8-bit RGB/RGBA non-interlaced PNGs, which is what Chromium emits.
 */
import { inflateSync } from 'node:zlib'

/** @returns {{width:number,height:number,data:Uint8Array}} RGBA8 pixels. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported')
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!channels) throw new Error(`unsupported colour type ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = new Uint8Array(width * height * 4)

  // Undo the per-scanline PNG filters.
  let prev = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    const cur = new Uint8Array(stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      const x = line[i]
      let v
      switch (filter) {
        case 0:
          v = x
          break
        case 1:
          v = x + a
          break
        case 2:
          v = x + b
          break
        case 3:
          v = x + ((a + b) >> 1)
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default:
          throw new Error(`unknown filter ${filter}`)
      }
      cur[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 4] = cur[x * channels]
      out[(y * width + x) * 4 + 1] = cur[x * channels + 1]
      out[(y * width + x) * 4 + 2] = cur[x * channels + 2]
      out[(y * width + x) * 4 + 3] = channels === 4 ? cur[x * channels + 3] : 255
    }
    prev = cur
  }

  return { width, height, data: out }
}

/**
 * Luminance and accent-colour statistics for a decoded frame.
 * Thresholds are deliberately low: this is a deliberately dark art direction,
 * and the question is whether *anything* is legible, not whether it is bright.
 */
export function frameStats({ width, height, data }) {
  let sum = 0
  let lit = 0
  let bright = 0
  let cyan = 0
  let green = 0
  let violet = 0
  const total = width * height

  for (let i = 0; i < total; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sum += lum
    if (lum > 18) lit++
    if (lum > 90) bright++
    if (b > 70 && g > 60 && r < g * 0.8) cyan++
    if (g > 70 && r < g * 0.85 && b < g) green++
    if (r > 50 && b > 90 && g < b * 0.85) violet++
  }

  const round = (v) => Math.round((v / total) * 1000) / 10
  return {
    mean: Math.round((sum / total) * 10) / 10,
    litPct: round(lit),
    brightPct: round(bright),
    cyanPct: round(cyan),
    greenPct: round(green),
    violetPct: round(violet),
  }
}