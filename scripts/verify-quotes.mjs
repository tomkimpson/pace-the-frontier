// Checks each unverified call's quote against its source page and writes a
// markdown report. Usage: node scripts/verify-quotes.mjs [--all] [--out report.md]
import { writeFile } from 'node:fs/promises';
import { loadCalls, checkQuote } from './lib.mjs';

const args = process.argv.slice(2);
const all = args.includes('--all');
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;

const calls = (await loadCalls()).filter((c) => all || !c.verified);
const rows = [];
for (const c of calls) {
  const r = await checkQuote(c.source_url, c.quote);
  const icon = r.ok === true ? '✅' : r.ok === false ? '❌' : '⚠️';
  rows.push({ icon, c, r });
  console.log(`${icon} ${c.person} — ${r.reason}`);
}

const md = [
  '### Quote check',
  '',
  '✅ found verbatim on the source page · ❌ not found · ⚠️ could not check automatically (check by hand)',
  '',
  '| | Person | Quote | Source | Result |',
  '|---|---|---|---|---|',
  ...rows.map(
    ({ icon, c, r }) =>
      `| ${icon} | ${c.person} | ${c.quote.replace(/\|/g, '\\|').slice(0, 90)}${c.quote.length > 90 ? '…' : ''} | [link](${c.source_url}) | ${r.reason} |`,
  ),
  '',
].join('\n');

if (out) await writeFile(out, md);
else console.log('\n' + md);
