#!/usr/bin/env node
// Arabic star-name navigation over the private cultural-astronomy library.
//
//   node arabic_sources.mjs list
//   node arabic_sources.mjs search <arabic-term> [--source <id>] [--context <0-3>] [--limit <n>] [--end yes]
//   node arabic_sources.mjs stellarium <arabic name | english name | HIP number>
//   add --root <dir> to point at another library root (tests use a synthetic one)
//
// Output is for private research sessions only: it returns locators and short context
// lines. Never paste its output into tracked files, fixtures, prompts to web tools, or
// memory. Matches are navigation pointers, not evidence; verify every claim against the
// source image or edition before recording it.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_ROOT = resolve(import.meta.dirname, '../../../../local-reference/cultural-astronomy');

// Registered Arabic texts (relative to <root>/sources). Folder-based so filenames can vary.
const SOURCES = [
  // The Ibn Qutaybah PDF text layer stores each line in visual (reversed) order.
  { id: 'ibn-qutayba', folder: 'primary-historical-texts/ibn-qutayba', text: 'derived/text-extracts/ibn-qutayba-kitab-al-anwa.txt', layer: 'anwaʾ (3rd/9th c.)', visualOrder: true },
  { id: 'al-marzuqi', folder: 'primary-historical-texts/al-marzouqi', pattern: /\.txt$/, layer: 'azmina/anwaʾ (5th/11th c.)' },
  { id: 'ibn-asim', folder: 'primary-historical-texts/al-thaqafi', pattern: /\.txt$/, layer: 'anwaʾ (Andalusi, d. 403/1013)' },
  { id: 'kitab-al-ayn', folder: 'lexical-sources/al-farahidi', pattern: /\.txt$/, layer: 'lexicon (2nd/8th c.)' },
];
const STELLARIUM = 'sources/derived-cultural-compilations/stellarium-arabic-ancient/index.json';

/** Fold Arabic orthographic variation so OCR text and queries compare equal. */
export function normalizeArabic(text) {
  return text
    .normalize('NFKC') // presentation forms (U+FB50-U+FEFF) -> base letters
    .replace(/[ً-ٰٟۖ-ۭ]/g, '') // harakat, dagger alif, Quranic marks
    .replace(/ـ/g, '') // tatweel
    .replace(/[آأإٱ]/g, 'ا') // alef variants -> ا
    .replace(/ى/g, 'ي') // alef maqsura -> ya
    .replace(/ة/g, 'ه') // ta marbuta -> ha
    .replace(/[‌-‏‪-‮]/g, '') // joiners and bidi controls
    .replace(/\s+/g, ' ');
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
    else args._.push(argv[i]);
  }
  return args;
}

function resolveSource(root, source) {
  if (source.text) {
    const path = join(root, source.text);
    return existsSync(path) ? [path] : [];
  }
  const dir = join(root, 'sources', source.folder);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => source.pattern.test(name)).map((name) => join(dir, name));
}

function list(root) {
  for (const source of SOURCES) {
    const files = resolveSource(root, source);
    if (files.length === 0) console.log(`${source.id.padEnd(13)} MISSING (${source.layer})`);
    for (const file of files) {
      const bytes = readFileSync(file);
      const sha = createHash('sha256').update(bytes).digest('hex');
      console.log(`${source.id.padEnd(13)} ${String(bytes.length).padStart(9)} B  sha256 ${sha.slice(0, 16)}…  ${source.layer}`);
    }
  }
  console.log(`stellarium    ${existsSync(join(root, STELLARIUM)) ? 'present' : 'MISSING'}  (modern compilation, CC BY-ND 4.0)`);
}

/** Restore logical order for a line extracted in visual order (keeps page markers intact). */
export function logicalOrder(line) {
  return /\[PDF_PAGE=\d+\]/.test(line) ? line : [...line.normalize('NFKC')].reverse().join('');
}

function search(root, term, { source, context = '0', limit = '25', end }) {
  const needle = normalizeArabic(term).trim();
  if (!needle) throw new Error('empty search term');
  // --end yes: the match must not continue into another Arabic letter (stem/word end).
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(end ? `${escaped}(?![\\u0621-\\u064A])` : escaped);
  const ctx = Math.min(3, Math.max(0, Number(context)));
  let total = 0;
  for (const src of SOURCES.filter((s) => !source || s.id === source)) {
    for (const file of resolveSource(root, src)) {
      const raw = readFileSync(file, 'utf8').split(/\r?\n/);
      const lines = src.visualOrder ? raw.map(logicalOrder) : raw;
      const hits = [];
      let page = null;
      lines.forEach((line, i) => {
        const marker = /\[PDF_PAGE=(\d+)\]/.exec(line);
        if (marker) page = marker[1];
        if (matcher.test(normalizeArabic(line))) hits.push({ i, page });
      });
      total += hits.length;
      console.log(`## ${src.id}: ${hits.length} matching line(s)`);
      for (const { i, page } of hits.slice(0, Number(limit))) {
        const where = page ? `PDF p.${page}, L${i + 1}` : `L${i + 1}`;
        console.log(`  ${where}`);
        for (let k = Math.max(0, i - ctx); k <= Math.min(lines.length - 1, i + ctx); k++) {
          console.log(`    ${k === i ? '>' : ' '} ${lines[k].trim().slice(0, 160)}`);
        }
      }
    }
  }
  if (total === 0) console.log('No match. Try a shorter stem or without the article ال.');
}

function stellarium(root, query) {
  const path = join(root, STELLARIUM);
  if (!existsSync(path)) throw new Error(`missing ${STELLARIUM}`);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const hip = /^\s*(?:HIP\s*)?(\d+)\s*$/i.exec(query)?.[1];
  const needle = normalizeArabic(query).toLowerCase();
  const names = (entry) => [entry.common_name?.native, entry.common_name?.english].filter(Boolean);
  for (const entry of data.constellations ?? []) {
    const members = [...new Set((entry.lines ?? []).flat().filter((x) => typeof x === 'number'))].sort((a, b) => a - b);
    const nameHit = names(entry).some((n) => normalizeArabic(n).toLowerCase().includes(needle));
    if ((hip && members.includes(Number(hip))) || (!hip && nameHit)) {
      console.log(`${entry.id} | ${names(entry).join(' | ')} | HIP ${members.join(', ')}`);
    }
  }
  for (const [key, values] of Object.entries(data.common_names ?? {})) {
    const keyHip = /^HIP (\d+)$/.exec(key)?.[1];
    const hit = hip ? keyHip === hip : values.some((v) => [v.native, v.english].some((n) => n && normalizeArabic(n).toLowerCase().includes(needle)));
    if (hit) console.log(`star ${key} | ${values.map((v) => [v.native, v.english].filter(Boolean).join(' / ')).join('; ')}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? DEFAULT_ROOT);
const [command, ...rest] = args._;
try {
  if (command === 'list') list(root);
  else if (command === 'search') search(root, rest.join(' '), args);
  else if (command === 'stellarium') stellarium(root, rest.join(' '));
  else {
    console.log('Usage: arabic_sources.mjs list | search <term> [--source id] [--context n] [--limit n] | stellarium <name|HIP> [--root dir]');
    process.exitCode = command ? 2 : 0;
  }
} catch (error) {
  console.error(`arabic_sources: ${error.message}`);
  process.exitCode = 1;
}
