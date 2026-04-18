const sharp = require('sharp')
const { writeFileSync, mkdirSync, rmSync } = require('fs')
const { join } = require('path')
const { tmpdir } = require('os')

const resourcesDir = join(__dirname, '../../resources')
mkdirSync(resourcesDir, { recursive: true })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="44" fill="#16213e"/>
  <rect x="4" y="4" width="248" height="248" rx="40" fill="none" stroke="#c9a84c" stroke-width="2" opacity="0.3"/>
  <rect x="110" y="44" width="36" height="168" rx="7" fill="#c9a84c"/>
  <rect x="54" y="96" width="148" height="36" rx="7" fill="#c9a84c"/>
  <rect x="110" y="44" width="10" height="168" rx="7" fill="#e8c96a" opacity="0.4"/>
  <rect x="54" y="96" width="148" height="10" rx="7" fill="#e8c96a" opacity="0.4"/>
</svg>`

async function run() {
  const tmpDir = join(tmpdir(), 'bible-icon-gen')
  mkdirSync(tmpDir, { recursive: true })

  // Generate PNGs at each size and save to temp files
  const sizes = [16, 24, 32, 48, 64, 128, 256]
  console.log('Generating icon sizes...')
  const tmpFiles = await Promise.all(
    sizes.map(async (size) => {
      const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
      const p = join(tmpDir, `icon-${size}.png`)
      writeFileSync(p, buf)
      console.log(`  ${size}x${size} done`)
      return p
    })
  )

  // Use png-to-ico via dynamic import (it's ESM-only)
  console.log('Converting to .ico...')
  const { default: pngToIco } = await import('png-to-ico')
  const icoBuffer = await pngToIco(tmpFiles)
  const icoPath = join(resourcesDir, 'icon.ico')
  writeFileSync(icoPath, icoBuffer)
  console.log(`Icon written to: ${icoPath}`)

  // Save 256px PNG too (used by macOS / Linux later)
  const pngBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()
  const pngPath = join(resourcesDir, 'icon.png')
  writeFileSync(pngPath, pngBuf)
  console.log(`PNG written to:  ${pngPath}`)

  // Clean up temp files
  rmSync(tmpDir, { recursive: true, force: true })
  console.log('Done.')
}

run().catch(console.error)
