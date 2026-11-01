import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Exercises the Arabic source-navigation tool against a SYNTHETIC library. The words
// below are generic test vocabulary (تجربة "test", نجم "star"), not cultural claims, and
// no private corpus is read.
const tool = join(
  import.meta.dirname,
  '..',
  '..',
  '.agents/skills/ufuq-najdi-arabian-sky/scripts/arabic_sources.mjs',
);
let root = '';

function run(...args: string[]): string {
  return execFileSync(process.execPath, [tool, ...args, '--root', root], { encoding: 'utf8' });
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ufuq-arabic-sources-'));
  const write = (relative: string, text: string): void => {
    mkdirSync(join(root, relative, '..'), { recursive: true });
    writeFileSync(join(root, relative), text, 'utf8');
  };
  // Diacritics, tatweel and an alef-hamza variant must fold to the plain query form.
  write(
    'sources/primary-historical-texts/al-marzouqi/synthetic_djvu.txt',
    'سطر أول\nهذا نَجْمُ التـجربة الأولى\nوهذا التجريبي فقط\n',
  );
  // Visual-order source: the line is stored reversed, as in the Ibn Qutaybah extract.
  const reversed = [...'نجم التجربة في الكتاب'].reverse().join('');
  write('derived/text-extracts/ibn-qutayba-kitab-al-anwa.txt', `\n\n[PDF_PAGE=7]\n${reversed}\n`);
  write(
    'sources/derived-cultural-compilations/stellarium-arabic-ancient/index.json',
    JSON.stringify({
      constellations: [
        {
          id: 'CON synthetic 0001',
          common_name: { native: 'نجم التجربة', english: 'SYNTHETIC test figure' },
          lines: [[1, 2, 3]],
        },
      ],
      common_names: { 'HIP 2': [{ native: 'نجم', english: 'SYNTHETIC star' }] },
    }),
  );
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('arabic_sources tool', () => {
  it('folds harakat, tatweel and alef variants when searching', () => {
    const out = run('search', 'نجم التجربة');
    expect(out).toContain('## al-marzuqi: 1 matching line(s)');
    expect(out).toContain('L2');
  });

  it('restores logical order for visual-order sources and reports the PDF page', () => {
    const out = run('search', 'نجم التجربة', '--source', 'ibn-qutayba');
    expect(out).toContain('## ibn-qutayba: 1 matching line(s)');
    expect(out).toContain('PDF p.7');
  });

  it('can require a word end so a stem does not match a longer word', () => {
    expect(run('search', 'التجربة')).toContain('## al-marzuqi: 1 matching line(s)');
    // "التجري" is a prefix of "التجريبي" (line 3) only; with --end it must not match.
    const loose = run('search', 'التجري', '--source', 'al-marzuqi');
    const strict = run('search', 'التجري', '--source', 'al-marzuqi', '--end', 'yes');
    expect(loose).toContain('1 matching line(s)');
    expect(loose).toContain('L3');
    expect(strict).toContain('No match');
  });

  it('looks up compilation entries by HIP number and by name', () => {
    expect(run('stellarium', 'HIP 2')).toContain('HIP 1, 2, 3');
    expect(run('stellarium', 'HIP 2')).toContain('star HIP 2');
    expect(run('stellarium', 'نجم التجربة')).toContain('CON synthetic 0001');
  });

  it('reports missing registered sources instead of failing silently', () => {
    const out = run('list');
    expect(out).toMatch(/ibn-asim\s+MISSING/);
    expect(out).toMatch(/kitab-al-ayn\s+MISSING/);
  });
});
