#!/usr/bin/env node
/**
 * Build icons/fa/shims.json from Font Awesome 6 metadata.
 *
 * Sources (both shipped in @fortawesome/fontawesome-free):
 *   metadata/shims.yml          — v4→v6 renames (authoritative for v4, carries prefix)
 *   metadata/icon-families.json — canonical icons + aliases.names (covers FA5+ renames)
 *
 * shims.yml wins on conflict (its target is the preferred v6 name for v4 callers;
 * icon-families sometimes routes a v4 name through a FA5 intermediate).
 *
 * Output entries are gated on whether the target SVG exists in icons/fa/<style>/,
 * so we never shim into an icon the package can't serve.
 *
 * Usage:
 *   # @fortawesome/fontawesome-free is read from slidecraft's install (no local dep)
 *   node build-shims.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const FA_DIR = resolve(
  __dirname,
  '../../4p/slidecraft/src/slidecraft_server/lib/node_modules/@fortawesome/fontawesome-free'
)
const ICONS_DIR = resolve(__dirname, 'icons/fa')

const PREFIX_TO_STYLE = { fas: 'solid', far: 'regular', fab: 'brands' }

// Minimal YAML parser for shims.yml — top-level keys, two-space indented scalar fields.
function parseShimsYaml(text) {
  const out = {}
  let key = null
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const top = line.match(/^([A-Za-z0-9][A-Za-z0-9_-]*):\s*$/)
    if (top) { key = top[1]; out[key] = {}; continue }
    const kv = line.match(/^\s+([a-z]+):\s*(.+?)\s*$/)
    if (kv && key) out[key][kv[1]] = kv[2]
  }
  return out
}

function pickStyle(info) {
  const styles = Object.keys(info.svgs?.classic ?? {})
  if (styles.includes('brands')) return 'brands'
  if (styles.includes('solid')) return 'solid'
  if (styles.includes('regular')) return 'regular'
  return styles[0] ?? null
}

const svgExists = (style, name) => existsSync(join(ICONS_DIR, style, `${name}.svg`))
const entry = (name, style) => (style === 'solid' ? { name } : { name, style })

const icons = JSON.parse(readFileSync(join(FA_DIR, 'metadata/icon-families.json'), 'utf-8'))
const v4 = parseShimsYaml(readFileSync(join(FA_DIR, 'metadata/shims.yml'), 'utf-8'))

const shims = {}
let fromAliases = 0
let skippedAliases = 0

for (const [canonical, info] of Object.entries(icons)) {
  const aliases = info.aliases?.names
  if (!aliases?.length) continue
  const style = pickStyle(info)
  if (!style || !svgExists(style, canonical)) { skippedAliases += aliases.length; continue }
  for (const alias of aliases) {
    shims[alias] = entry(canonical, style)
    fromAliases++
  }
}

let fromV4 = 0
let skippedV4 = 0
for (const [old, { name, prefix }] of Object.entries(v4)) {
  if (!name) continue
  const style = PREFIX_TO_STYLE[prefix] ?? 'solid'
  if (!svgExists(style, name)) { skippedV4++; continue }
  shims[old] = entry(name, style)
  fromV4++
}

const sorted = Object.fromEntries(Object.keys(shims).sort().map(k => [k, shims[k]]))
writeFileSync(join(ICONS_DIR, 'shims.json'), JSON.stringify(sorted))

console.log(`shims.json: ${Object.keys(sorted).length} entries`)
console.log(`  from icon-families aliases: ${fromAliases} (skipped ${skippedAliases} — target svg missing)`)
console.log(`  from shims.yml (v4):        ${fromV4} (skipped ${skippedV4} — target svg missing)`)
