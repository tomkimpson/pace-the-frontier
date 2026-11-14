// Shared helpers for the weekly agent and the quote verifier.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

export const CALLS_DIR = 'src/data/calls';
export const STANCES = ['pause', 'prohibit', 'moratorium', 'slow'];
export const SECTORS = ['industry', 'academia', 'government', 'civil-society', 'faith', 'arts', 'media'];
export const SOURCE_TYPES = [
  'essay', 'interview', 'post', 'speech', 'letter', 'testimony', 'legislation', 'podcast', 'article',
];

export async function loadCalls(dir = CALLS_DIR) {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.yaml'));
  return Promise.all(
    files.map(async (f) => ({ file: path.join(dir, f), ...parse(await readFile(path.join(dir, f), 'utf8')) })),
  );
}

export function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// One rules text shared by the proposing agent and the relevance judge, so the
// two can never drift apart. The "not a call" list comes from real mistakes in
// the seed data; add to it when a new kind of false positive gets through.
export const INCLUSION_RULES = `An entry qualifies only if ALL of these hold:
1. The speaker is a named, identifiable person (researcher, executive, politician, official, public figure). Statements by an organisation alone do not count.
2. In their own words, the speaker calls for, endorses, or says they support pausing, slowing, pacing, a moratorium on, or prohibiting frontier/advanced AI development. Compute or data-centre moratoria aimed at AI count.
3. The quote is the sentence in which they make that call, copied verbatim from the source. It is not a nearby hedge, caveat or aside.

These are NOT calls, even when the words "pause", "slow" or "stop" appear:
- Asking that humanity keep the ABILITY to pause (an off-switch, a "pause button", the capacity to stop) without calling for a pause.
- Hypothetical or descriptive statements: what labs might do in some scenario, what a pause would achieve, predictions that someone will slow down.
- Resignation without endorsement: "it can't be slowed", "nobody can stop it". (If they also say they WANT it slowed, that part can count; mark it conditional only if they state a condition.)
- Calls only for regulation, safety testing, evaluations, transparency, licensing or standards, with no call to slow, pause or prohibit.
- Someone else's paraphrase or summary of the speaker's view rather than the speaker's own words.
- Endorsing another person's essay or proposal in general terms, unless the endorsement itself backs slowing or pausing.

"conditional" is true only when the speaker states a condition on their support (for example "only if other labs do too", "if we can verify compliance"). A hedge such as "the details need working through" is not a condition.`;

// Normalise text so typographic differences don't fail an otherwise exact match.
// Case is kept so the judge sees readable text; compare with matchable().
export function tidy(s) {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalise(s) {
  return tidy(s).toLowerCase();
}

// The form of a quote used for matching: normalised, without wrapping quote
// marks or a trailing full stop.
export function matchable(quote) {
  return normalise(quote).replace(/^["']|["'.]$/g, '');
}

function safeChar(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return ' ';
  }
}

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;|&ndash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(Number(d)));
}

// Fetches a page and returns its visible text, tidied. { text } or { error }.
export async function fetchPageText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (pace-the-frontier quote verifier)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { text: tidy(htmlToText(await res.text())) };
  } catch (e) {
    return { error: e.name === 'TimeoutError' ? 'timed out' : e.message };
  }
}

// Returns the text around position idx: `chars` either side, widened to word breaks.
export function windowAround(text, idx, len, chars = 2500) {
  let a = Math.max(0, idx - chars);
  let b = Math.min(text.length, idx + len + chars);
  if (a > 0) a = text.indexOf(' ', a) + 1;
  if (b < text.length) b = Math.max(text.lastIndexOf(' ', b), idx + len);
  return (a > 0 ? '… ' : '') + text.slice(a, b) + (b < text.length ? ' …' : '');
}

async function checkOne(url, quote) {
  const page = await fetchPageText(url);
  if (page.error) return { ok: null, reason: page.error };
  const lower = page.text.toLowerCase();
  // toLowerCase can change length for a few non-ASCII characters; then fall
  // back to searching the lowercased text for both match and window.
  const text = lower.length === page.text.length ? page.text : lower;
  const q = matchable(quote);
  const idx = lower.indexOf(q);
  if (idx >= 0) return { ok: true, reason: 'exact match', window: windowAround(text, idx, q.length) };
  // Partial: does a long leading chunk match? Helps spot small transcription slips.
  const head = q.slice(0, Math.max(20, Math.floor(q.length * 0.5)));
  const hIdx = lower.indexOf(head);
  if (hIdx >= 0)
    return { ok: false, reason: 'only the first half matches; check wording', window: windowAround(text, hIdx, head.length) };
  if (page.text.length < 2000) return { ok: null, reason: 'page has little text (likely JS-rendered or blocked)' };
  return { ok: false, reason: 'quote not found on page' };
}

// Returns { ok: true|false|null, reason, window? }. null = could not check
// (blocked, paywalled, JS-only). `window` is the page text around the quote.
// If the source can't be read, tries the archive copy instead.
export async function checkQuote(url, quote, archiveUrl) {
  const r = await checkOne(url, quote);
  if (r.ok !== null || !archiveUrl) return r;
  const a = await checkOne(archiveUrl, quote);
  return { ...a, reason: `source: ${r.reason}; archive: ${a.reason}` };
}
