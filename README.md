# Pace the Frontier

A running record of public calls to pause, slow or prohibit frontier AI development, in the speakers' own words.

Static [Astro](https://astro.build) site on GitHub Pages. A weekly GitHub Action asks Claude (with web search) for new calls, runs each through a relevance gate, and opens a pull request; nothing goes live until a person reviews and merges it.

## How it fits together

```
src/data/calls/*.yaml     one file per quote (named voices)
src/data/letters/*.yaml   open letters with signatory counts
src/content.config.ts     schema; the build fails on invalid data
src/pages/index.astro     the whole site
scripts/lib.mjs           shared helpers, including INCLUSION_RULES (what counts as a call)
scripts/propose.mjs       weekly agent: proposes new entries, then gates them
scripts/relevance.mjs     relevance gate: a second model call judges the fetched source text
scripts/check-relevance.mjs  runs the gate over entries (PR checks, or by hand)
scripts/verify-quotes.mjs fetches each source and checks the quote is verbatim
.github/workflows/        deploy (push to main), weekly agent (cron), check (PRs)
```

## Adding an entry by hand

Copy any file in `src/data/calls/`, edit it, and open a PR. Rules:

- The speaker must actually call for pausing, slowing or prohibiting frontier AI. The full rules, including what doesn't count (asking for the *ability* to pause, hypotheticals, resignation, hedges), are `INCLUSION_RULES` in `scripts/lib.mjs`.
- `quote` must be verbatim from `source_url`, and be the sentence that makes the call. Our own context goes in `summary` (shown) or `notes` (never shown).
- `stance`: `pause` | `prohibit` | `moratorium` | `slow`. Set `conditional: true` for "only if others do".
- `primary_source: false` if the quote comes via a compilation or news report rather than the original.
- `archive_url`: a Wayback Machine copy. The checks fall back to it when the source blocks automated fetches.
- Set `verified: true` and `verified_by` once you've personally checked the quote. Unverified entries show a small "unverified" badge.

## One-time setup

1. **Pages:** Settings → Pages → Source: *GitHub Actions*. (Pages on a private repo needs a paid plan; it's free once public.)
2. **API key:** Settings → Secrets and variables → Actions → New secret `ANTHROPIC_API_KEY`.
3. **Let Actions open PRs:** Settings → Actions → General → Workflow permissions → tick *Allow GitHub Actions to create and approve pull requests*.
4. Optional: repository variable `AGENT_MODEL` to change the model (default `claude-sonnet-5-5`).
5. Test the agent: Actions → Weekly agent → Run workflow.

## The relevance gate

Every proposal from the weekly agent is checked before it reaches the PR:

- The script fetches `source_url` (or `archive_url`). If the quote isn't there verbatim, the proposal is **rejected**.
- A separate model call reads the page text around the quote against `INCLUSION_RULES`, and returns a verdict plus the sentence that makes the call.
  - `exclude` is **rejected**.
  - `borderline`, a different operative sentence, or a disagreement over stance or `conditional` is **flagged** (🟡) in the PR.
- If the source can't be read, or the judge fails, the entry is kept and marked ⚠️ for a manual check.

Rejected proposals are listed, with reasons, in a collapsed section of the PR and on the Actions run summary. PRs that add or change call entries get the same check (informational) in the *Check* workflow.

## Local development

```sh
npm install
npm run dev                         # http://localhost:4321/pace-the-frontier/
npm run verify                      # check unverified quotes against their sources
ANTHROPIC_API_KEY=... npm run propose
ANTHROPIC_API_KEY=... node scripts/check-relevance.mjs src/data/calls/some-entry.yaml
```
