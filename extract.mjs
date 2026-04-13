#!/usr/bin/env node
/**
 * One-time extraction script.
 *
 * 1. Parses react-icons CJS index files → individual JSON files per icon.
 * 2. Copies flag SVGs from the slidecraft lib assets.
 *
 * Usage:
 *   npm install react-icons   (in this directory)
 *   node extract.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Config ──────────────────────────────────────────────────────────────────

const LIBS = ['fa', 'lu', 'tb', 'bs', 'md', 'ai', 'hi']

// Path to the local fa.js (react-icons CJS format)
const FA_LOCAL = resolve(
  __dirname,
  '../../4p/slidecraft/src/slidecraft_server/lib/assets/fa.js'
)

// Path to flag SVGs
const FLAGS_SRC = resolve(
  __dirname,
  '../../4p/slidecraft/src/slidecraft_server/lib/assets/flags'
)

// react-icons installed in this package's node_modules
const REACT_ICONS_DIR = resolve(__dirname, 'node_modules/react-icons')

// ── Icon extraction ─────────────────────────────────────────────────────────

const ICON_RE = /module\.exports\.(\w+)\s*=\s*function\s+\w+\s*\(props\)\s*\{\s*return\s+GenIcon\(({[\s\S]*?})\)\(props\)/g

function extractIcons(src) {
  const icons = new Map()
  let m
  // Reset lastIndex for safety
  ICON_RE.lastIndex = 0
  while ((m = ICON_RE.exec(src)) !== null) {
    try {
      const data = JSON.parse(m[2])
      icons.set(m[1], data)
    } catch {
      console.warn(`  Failed to parse icon: ${m[1]}`)
    }
  }
  return icons
}

function writeIcons(lib, icons) {
  const outDir = join(__dirname, 'icons', lib)
  mkdirSync(outDir, { recursive: true })

  let count = 0
  for (const [name, data] of icons) {
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data))
    count++
  }
  console.log(`  ${lib}: ${count} icons`)
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('Extracting icons...')

for (const lib of LIBS) {
  let src

  if (lib === 'fa' && existsSync(FA_LOCAL)) {
    // Use local copy for fa
    src = readFileSync(FA_LOCAL, 'utf-8')
  } else {
    // Read from installed react-icons
    const indexPath = join(REACT_ICONS_DIR, lib, 'index.js')
    if (!existsSync(indexPath)) {
      console.warn(`  ${lib}: not found at ${indexPath} — skipping`)
      continue
    }
    src = readFileSync(indexPath, 'utf-8')
  }

  const icons = extractIcons(src)
  writeIcons(lib, icons)
}

// ── Flags ───────────────────────────────────────────────────────────────────

console.log('Copying flags...')
const flagsOutDir = join(__dirname, 'flags')
mkdirSync(flagsOutDir, { recursive: true })

let flagCount = 0
for (const file of readdirSync(FLAGS_SRC)) {
  if (file.endsWith('.svg')) {
    copyFileSync(join(FLAGS_SRC, file), join(flagsOutDir, file))
    flagCount++
  }
}
console.log(`  ${flagCount} flags`)

console.log('Done.')
