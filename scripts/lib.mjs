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

// Normalise text so typographic differences don't fail an otherwise exact match.
export function normalise(s) {
  return s
    .normalize('NFKC')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;/g, ' ');
}

// Returns { ok: true|false|null, reason }. null = could not check (blocked, paywalled, JS-only).
export async function checkQuote(url, quote) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Mozilla/5.0 (pace-the-frontier quote verifier)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: null, reason: `HTTP ${res.status}` };
    const text = normalise(htmlToText(await res.text()));
    const q = normalise(quote).replace(/^["']|["'.]$/g, '');
    if (text.includes(q)) return { ok: true, reason: 'exact match' };
    // Partial: does a long leading chunk match? Helps spot small transcription slips.
    const head = q.slice(0, Math.max(20, Math.floor(q.length * 0.5)));
    if (text.includes(head)) return { ok: false, reason: 'only the first half matches; check wording' };
    if (text.length < 2000) return { ok: null, reason: 'page has little text (likely JS-rendered or blocked)' };
    return { ok: false, reason: 'quote not found on page' };
  } catch (e) {
    return { ok: null, reason: e.name === 'TimeoutError' ? 'timed out' : e.message };
  }
}
