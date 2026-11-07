import {
  CodingAgentAdapter,
  ProviderProbeResult,
  AgentSessionInput,
  AgentEvent,
} from './adapter-interface.js';

export class MockProvider implements CodingAgentAdapter {
  public readonly id = 'mock';
  public readonly name = 'Mock Deterministic Test Provider';

  private sessions = new Map<string, { id: string; input: AgentSessionInput; cancelled: boolean }>();

  public async probe(): Promise<ProviderProbeResult> {
    return {
      available: true,
      reason: 'Always available for tests and simulation',
      capabilities: ['streaming', 'tools:fs', 'tools:test', 'diff'],
      models: ['mock-instant', 'mock-error'],
    };
  }

  public async startSession(input: AgentSessionInput): Promise<{ sessionId: string }> {
    const sessionId = `mock-sess-${Date.now()}`;
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
      payload: { provider: 'mock', role: session.input.role.metadata.name },
    };

    yield {
      type: 'message_delta',
      seq: seq++,
      timestamp: nowIso(),
      payload: { text: `[Mock Provider] Running simulated turn for ${session.input.task.title}...\n` },
    };

    if (session.input.model === 'mock-error') {
      yield {
        type: 'error',
        seq: seq++,
        timestamp: nowIso(),
        payload: { message: 'Simulated task failure' },
      };
      yield {
        type: 'finished',
        seq: seq++,
        timestamp: nowIso(),
        payload: { status: 'failed' },
      };
      return;
    }

    yield {
      type: 'usage_reported',
      seq: seq++,
      timestamp: nowIso(),
      payload: { tokensPrompt: 100, tokensCompletion: 50, costUsd: 0 },
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
