// Runs the relevance gate over call entries and writes a markdown report.
// Usage: node scripts/check-relevance.mjs [--all] [--out report.md] [file.yaml ...]
// With no files and no --all, checks unverified entries. Needs ANTHROPIC_API_KEY.
// Informational: always exits 0 unless the script itself breaks.
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { loadCalls } from './lib.mjs';
import { gate, makeClient, STATUS_ICON } from './relevance.mjs';

const MODEL = process.env.MODEL || 'claude-sonnet-5-5';
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const files = args.filter((a, i) => a.endsWith('.yaml') && !(outIdx >= 0 && i === outIdx + 1));

const calls = files.length
  ? await Promise.all(files.map(async (f) => ({ file: f, ...parse(await readFile(f, 'utf8')) })))
  : (await loadCalls()).filter((c) => args.includes('--all') || !c.verified);

const client = makeClient();
const rows = [];
for (const c of calls) {
  const r = await gate(client, MODEL, c);
  rows.push({ c, r });
  console.log(`${STATUS_ICON[r.status]} ${c.person} (${path.basename(c.file)}) — ${r.reasons.join(' | ')}`);
}

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  '### Relevance check',
  '',
  `Model: \`${MODEL}\`. ✅ qualifies · 🟡 keep but look at the note · ❌ judge says it doesn't qualify, or quote not on page · ⚠️ couldn't check`,
  '',
  '| | Person | Quote | Notes |',
  '|---|---|---|---|',
  ...rows.map(
    ({ c, r }) =>
      `| ${STATUS_ICON[r.status]} | ${esc(c.person)} | ${esc(c.quote.slice(0, 80))}${c.quote.length > 80 ? '…' : ''} | ${esc(r.reasons.join(' · '))} |`,
  ),
  '',
].join('\n');

if (out) await writeFile(out, md);
else console.log('\n' + md);
