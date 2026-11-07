import {
  CodingAgentAdapter,
  ProviderProbeResult,
  AgentSessionInput,
  AgentEvent,
} from './adapter-interface.js';

export class OpenCodeProvider implements CodingAgentAdapter {
  public readonly id = 'opencode';
  public readonly name = 'OpenCode Native Adapter';

  private sessions = new Map<string, { id: string; input: AgentSessionInput; cancelled: boolean }>();

  public async probe(): Promise<ProviderProbeResult> {
    return {
      available: true,
      reason: 'OpenCode adapter ready for integration',
      capabilities: ['acp', 'streaming', 'multi-provider', 'tools:fs'],
      models: ['opencode-default', 'deepseek-coder', 'qwen-coder'],
    };
  }

  public async startSession(input: AgentSessionInput): Promise<{ sessionId: string }> {
    const sessionId = `opencode-sess-${Date.now()}`;
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
      payload: { provider: 'opencode', role: session.input.role.metadata.name },
    };

    yield {
      type: 'message_delta',
      seq: seq++,
      timestamp: nowIso(),
      payload: { text: `[OpenCode] Processing worktree task "${session.input.task.title}"...\n` },
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
