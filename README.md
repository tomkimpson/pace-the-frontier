# Pace the Frontier

A running record of public calls to pause, slow or prohibit frontier AI development, in the speakers' own words.

Static [Astro](https://astro.build) site on GitHub Pages. A weekly GitHub Action asks Claude (with web search) for new calls and opens a pull request; nothing goes live until a person reviews and merges it.

## How it fits together

```
src/data/calls/*.yaml     one file per quote (named voices)
src/data/letters/*.yaml   open letters with signatory counts
src/content.config.ts     schema; the build fails on invalid data
src/pages/index.astro     the whole site
scripts/propose.mjs       weekly agent: proposes new entries
scripts/verify-quotes.mjs fetches each source and checks the quote is verbatim
.github/workflows/        deploy (push to main), weekly agent (cron), check (PRs)
```

## Adding an entry by hand

Copy any file in `src/data/calls/`, edit it, and open a PR. Rules:

- `quote` must be verbatim from `source_url`. Our own context goes in `summary` (shown) or `notes` (never shown).
- `stance`: `pause` | `prohibit` | `moratorium` | `slow`. Set `conditional: true` for "only if others do".
- `primary_source: false` if the quote comes via a compilation or news report rather than the original.
- Set `verified: true` and `verified_by` once you've personally checked the quote. Unverified entries show a small "unverified" badge.

## One-time setup

1. **Pages:** Settings → Pages → Source: *GitHub Actions*. (Pages on a private repo needs a paid plan; it's free once public.)
2. **API key:** Settings → Secrets and variables → Actions → New secret `ANTHROPIC_API_KEY`.
3. **Let Actions open PRs:** Settings → Actions → General → Workflow permissions → tick *Allow GitHub Actions to create and approve pull requests*.
4. Optional: repository variable `AGENT_MODEL` to change the model (default `claude-sonnet-5-5`).
5. Test the agent: Actions → Weekly agent → Run workflow.

## Local development

```sh
npm install
npm run dev                         # http://localhost:4321/pace-the-frontier/
npm run verify                      # check unverified quotes against their sources
ANTHROPIC_API_KEY=... npm run propose
```
