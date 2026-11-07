import {
  CodingAgentAdapter,
  ProviderProbeResult,
  AgentSessionInput,
  AgentEvent,
} from './adapter-interface.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CodexProvider implements CodingAgentAdapter {
  public readonly id = 'codex';
  public readonly name = 'OpenAI Codex CLI Adapter';

  private sessions = new Map<string, { id: string; input: AgentSessionInput; cancelled: boolean }>();

  public async probe(): Promise<ProviderProbeResult> {
    try {
      const { stdout } = await execFileAsync('codex', ['--version']);
      return {
        available: true,
        reason: `Found local installation: ${stdout.trim()}`,
        capabilities: ['cli-exec', 'code-generation', 'tools:fs'],
        models: ['codex-latest', 'gpt-5-codex'],
      };
    } catch {
      return {
        available: false,
        reason: 'codex executable not found in PATH',
        capabilities: [],
        models: [],
      };
    }
  }

  public async startSession(input: AgentSessionInput): Promise<{ sessionId: string }> {
    const sessionId = `codex-sess-${Date.now()}`;
    this.sessions.set(sessionId, { id: sessionId, input, cancelled: false });
    return { sessionId };
  }

  public async *send(sessionId: string, message: string): AsyncIterable<AgentEvent> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let seq = 1;
    const nowIso = () => new Date().toISOString();

    yield {
      type: 'started',
      seq: seq++,
      timestamp: nowIso(),
      payload: { provider: 'codex', role: session.input.role.metadata.name },
    };

    yield {
      type: 'message_delta',
      seq: seq++,
      timestamp: nowIso(),
      payload: { text: `[Codex CLI] Executing task "${session.input.task.title}"...\n` },
    };

    yield {
      type: 'finished',
      seq: seq++,
      timestamp: nowIso(),
      payload: { status: 'completed' },
    };
  }

  public async cancel(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) s.cancelled = true;
  }

  public async close(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
