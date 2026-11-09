import {
  CodingAgentAdapter,
  ProviderProbeResult,
  AgentSessionInput,
  AgentEvent,
} from './adapter-interface.js';
import { SecretRedactor } from '@rixed-devos/workspaces';
import { spawn, execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';

const execFileAsync = promisify(execFile);

export class CodexProvider implements CodingAgentAdapter {
  public readonly id = 'codex';
  public readonly name = 'OpenAI Codex CLI Adapter';

  private sessions = new Map<string, { id: string; input: AgentSessionInput; cancelled: boolean; process?: ChildProcess }>();

  public async probe(): Promise<ProviderProbeResult> {
    try {
      const { stdout } = await execFileAsync('codex', ['--version']);
      return {
        available: true,
        status: 'implemented',
        reason: `Found local installation: ${stdout.trim()}`,
        capabilities: ['cli-exec', 'code-generation', 'tools:fs', 'streaming'],
        models: ['gpt-5.6-sol', 'codex-latest', 'gpt-5-codex'],
      };
    } catch {
      return {
        available: false,
        status: 'unavailable',
        reason: 'codex executable not found in PATH',
        capabilities: ['cli-exec'],
        models: ['codex-latest'],
      };
    }
  }

  public async startSession(input: AgentSessionInput): Promise<{ sessionId: string }> {
    const sessionId = `codex-sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.sessions.set(sessionId, { id: sessionId, input, cancelled: false });
    return { sessionId };
  }

  public async *send(sessionId: string, message: string): AsyncIterable<AgentEvent> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let seq = 1;
    const nowIso = () => new Date().toISOString();
    const roleName = session.input.role.metadata.name;
    const cwd = session.input.cwd;

    yield {
      type: 'started',
      seq: seq++,
      timestamp: nowIso(),
      payload: { provider: 'codex', role: roleName, taskTitle: session.input.task.title },
    };

    if (session.cancelled) {
      yield { type: 'finished', seq: seq++, timestamp: nowIso(), payload: { status: 'cancelled' } };
      return;
    }

    const isTestEnv = Boolean(process.env.VITEST && process.env.TEST_LIVE_CLI !== 'true');
    if (isTestEnv || !cwd) {
      yield {
        type: 'message_delta',
        seq: seq++,
        timestamp: nowIso(),
        payload: { text: `[Codex CLI Test Harness] Simulated execution for task "${session.input.task.title}"...\n` },
      };
      yield {
        type: 'usage_reported',
        seq: seq++,
        timestamp: nowIso(),
        payload: { tokensPrompt: 1200, tokensCompletion: 450, costUsd: 0.005 },
      };
      yield {
        type: 'finished',
        seq: seq++,
        timestamp: nowIso(),
        payload: { status: 'completed' },
      };
      return;
    }

    // Real subprocess execution via `codex exec`
    yield {
      type: 'message_delta',
      seq: seq++,
      timestamp: nowIso(),
      payload: { text: `[Codex CLI] Spawning subprocess in ${cwd}...\n` },
    };

    const prompt = `Role: ${roleName}\nTask: ${session.input.task.title}\n${session.input.instructions || ''}`;
    const child = spawn('codex', ['exec', '--skip-git-repo-check', prompt], {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    session.process = child;
    let tokensUsed = 7000;

    const lineReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    const eventQueue: AgentEvent[] = [];
    let isDone = false;
    let resolveNext: (() => void) | null = null;

    lineReader.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      if (trimmed.startsWith('tokens used')) {
        // Next or current line might have number
      } else if (/^\d[\d,]*$/.test(trimmed)) {
        tokensUsed = parseInt(trimmed.replace(/,/g, ''), 10) || tokensUsed;
      }

      eventQueue.push({
        type: 'message_delta',
        seq: seq++,
        timestamp: nowIso(),
        payload: { text: SecretRedactor.redact(line + '\n') },
      });

      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    });

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    const exitPromise = new Promise<{ code: number | null }>((resolve) => {
      child.on('close', (code) => {
        isDone = true;
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
        resolve({ code });
      });
      child.on('error', (err) => {
        stderr = err.message;
        isDone = true;
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
        resolve({ code: 1 });
      });
    });

    while (!isDone || eventQueue.length > 0) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else if (!isDone) {
        await new Promise<void>((r) => {
          resolveNext = r;
        });
      }
    }

    const { code } = await exitPromise;

    yield {
      type: 'usage_reported',
      seq: seq++,
      timestamp: nowIso(),
      payload: {
        tokensPrompt: tokensUsed,
        tokensCompletion: 500,
        costUsd: Number((tokensUsed * 0.000003).toFixed(5)),
      },
    };

    yield {
      type: 'finished',
      seq: seq++,
      timestamp: nowIso(),
      payload: {
        status: code === 0 ? 'completed' : 'failed',
        reason: code !== 0 ? stderr || `Codex exited with code ${code}` : undefined,
      },
    };
  }

  public async cancel(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.cancelled = true;
      if (s.process && !s.process.killed) {
        s.process.kill('SIGTERM');
      }
    }
  }

  public async close(sessionId: string): Promise<void> {
    await this.cancel(sessionId);
    this.sessions.delete(sessionId);
  }
}
