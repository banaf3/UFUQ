import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the agent-instruction layer: Claude wrappers must mirror the canonical
// `.agents/skills`, documented repository paths must exist, and the destructive-command
// rule that protects the private ignored library must stay in AGENTS.md.

const root = join(import.meta.dirname, '..', '..');
const read = (path: string): string =>
  readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');

function frontMatter(path: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(read(path));
  if (!match?.[1]) throw new Error(`${path} has no front matter`);
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const field = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (field?.[1] && field[2] !== undefined) fields[field[1]] = field[2].trim();
  }
  return fields;
}

const canonicalSkills = readdirSync(join(root, '.agents/skills'));
const claudeOnlySkills = new Set(['ufuq-reference']);

describe('Claude skill wrappers', () => {
  it.each(canonicalSkills)('%s has a wrapper with identical name and description', (skill) => {
    const canonical = frontMatter(`.agents/skills/${skill}/SKILL.md`);
    const wrapperPath = `.claude/skills/${skill}/SKILL.md`;
    expect(existsSync(join(root, wrapperPath))).toBe(true);
    const wrapper = frontMatter(wrapperPath);
    expect(wrapper.name).toBe(canonical.name);
    expect(wrapper.description).toBe(canonical.description);
    expect(read(wrapperPath)).toContain(`.agents/skills/${skill}/SKILL.md`);
  });

  it('has no wrapper without a canonical skill except Claude-only skills', () => {
    const orphans = readdirSync(join(root, '.claude/skills')).filter(
      (skill) => !claudeOnlySkills.has(skill) && !canonicalSkills.includes(skill),
    );
    expect(orphans).toEqual([]);
  });
});

describe('agent documentation paths', () => {
  const documents = ['CLAUDE.md', 'AGENTS.md', 'docs/AGENT_WORKFLOW.md', 'docs/HANDOFF.md'];
  const trackedPrefix = /^(?:docs|\.agents|\.claude|\.agent|tools|packages|apps|scripts|tests)\//;

  it.each(documents)('%s only names repository paths that exist', (document) => {
    const missing = [...read(document).matchAll(/`([^`\s]+)`/g)]
      .map((match) => match[1] ?? '')
      .filter((path) => trackedPrefix.test(path) && !/[<>*{}]/.test(path))
      .map((path) => path.replace(/[/.,:;]+$/, ''))
      .filter((path) => !existsSync(join(root, path)));
    expect(missing).toEqual([]);
  });
});

describe('destructive-command safety rule', () => {
  it('AGENTS.md forbids git clean on ignored files', () => {
    const agents = read('AGENTS.md');
    expect(agents).toContain('## Destructive-command safety');
    expect(agents).toMatch(/Never run `git clean -x`\/`-X`/);
  });
});
