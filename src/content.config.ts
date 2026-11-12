import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Shared vocabularies — keep in sync with scripts/schema.mjs
export const STANCES = ['pause', 'prohibit', 'moratorium', 'slow'] as const;
export const SECTORS = [
  'industry',
  'academia',
  'government',
  'civil-society',
  'faith',
  'arts',
  'media',
] as const;
export const SOURCE_TYPES = [
  'essay',
  'interview',
  'post',
  'speech',
  'letter',
  'testimony',
  'legislation',
  'podcast',
  'article',
] as const;

const calls = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data/calls' }),
  schema: z.object({
    person: z.string(),
    role: z.string(), // role at the time of the statement
    sector: z.enum(SECTORS),
    country: z.string().length(2), // ISO 3166-1 alpha-2
    date: z.coerce.date(),
    quote: z.string().min(8), // verbatim, exactly as in the source
    summary: z.string().optional(), // our own one-line context, shown publicly, never presented as a quote
    notes: z.string().optional(), // editor-only notes, never rendered
    source_url: z.string().url(),
    source_type: z.enum(SOURCE_TYPES),
    primary_source: z.boolean().default(true), // false if quote is via a secondary compilation
    archive_url: z.string().url().optional(),
    stance: z.enum(STANCES),
    conditional: z.boolean().default(false), // e.g. "only if others do too"
    letters: z.array(z.string()).default([]),
    added: z.coerce.date(),
    verified: z.boolean().default(false), // a human has checked the quote against the source
    verified_by: z.string().optional(),
  }),
});

const letters = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/data/letters' }),
  schema: z.object({
    title: z.string(),
    organiser: z.string(),
    date: z.coerce.date(),
    ask: z.string(), // verbatim core demand
    url: z.string().url(),
    signatories: z.number().int().nonnegative(),
    signatories_as_of: z.coerce.date(),
    stance: z.enum(STANCES),
    notable: z.array(z.string()).default([]),
    verified: z.boolean().default(false),
  }),
});

export const collections = { calls, letters };
