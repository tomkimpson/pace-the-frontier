// Runs Claude through the Claude Code CLI in headless mode (`claude -p`), so the
// scripts can use a Claude subscription instead of an API key.
//
// Auth: locally, your normal `claude` login. In CI, CLAUDE_CODE_OAUTH_TOKEN
// (from `claude setup-token`). ANTHROPIC_API_KEY is removed from the child's
// environment, because `claude -p` would otherwise bill the API instead.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

// Returns the parsed structured output (matching `schema`).
// Throws on CLI failure, timeout, or missing structured output.
export async function runClaude({ prompt, system, schema, model, tools = [], maxTurns = 4, timeoutMs = 10 * 60e3 }) {
  const toolList = tools.join(',');
  const args = [
    '-p',
    '--output-format', 'json',
    '--model', model,
    '--max-turns', String(maxTurns),
    '--json-schema', JSON.stringify(schema),
    '--tools', toolList,
    '--permission-prompts', 'none',
    // Keep the run self-contained: no user/project settings, hooks, MCP
    // servers, skills or saved sessions.
    '--setting-sources', '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--no-session-persistence',
  ];
  if (toolList) args.push('--allowedTools', toolList);
  if (system) args.push('--system-prompt', system);

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  // Run from an empty directory so no CLAUDE.md or project files are picked up.
  const cwd = await mkdtemp(path.join(tmpdir(), 'ptf-claude-'));
  try {
    const out = await new Promise((resolve, reject) => {
      const child = spawn(CLAUDE_BIN, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`claude timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => (stderr += d));
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(new Error(`could not run ${CLAUDE_BIN}: ${e.message}`));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (!stdout.trim()) return reject(new Error(`claude exited ${code}: ${stderr.trim().slice(0, 500)}`));
        resolve(stdout);
      });
      child.stdin.end(prompt);
    });
    let res;
    try {
      res = JSON.parse(out);
    } catch {
      throw new Error(`claude returned non-JSON output: ${out.slice(0, 300)}`);
    }
    if (res.is_error) throw new Error(`claude run failed (${res.subtype ?? 'error'}): ${String(res.result ?? '').slice(0, 300)}`);
    if (res.structured_output == null)
      throw new Error(`claude finished without structured output (${res.subtype ?? 'unknown'}, ${res.num_turns ?? '?'} turns)`);
    return res.structured_output;
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
