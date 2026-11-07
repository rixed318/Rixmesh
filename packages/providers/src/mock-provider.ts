import {
  CodingAgentAdapter,
  ProviderProbeResult,
  AgentSessionInput,
  AgentEvent,
} from './adapter-interface.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export class MockProvider implements CodingAgentAdapter {
  public readonly id = 'mock';
  public readonly name = 'Mock Deterministic Test Provider';

  private sessions = new Map<string, { id: string; input: AgentSessionInput; cancelled: boolean }>();

  public async probe(): Promise<ProviderProbeResult> {
    return {
      available: true,
      status: 'tested-mock',
      reason: 'Deterministic mock provider for automated unit, integration, and E2E testing.',
      capabilities: ['streaming', 'tools:fs', 'tools:test', 'diff', 'review-simulation'],
      models: ['mock-instant', 'mock-error', 'mock-exceed-budget', 'mock-test-fail'],
    };
  }

  public async startSession(input: AgentSessionInput): Promise<{ sessionId: string }> {
    const sessionId = `mock-sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.sessions.set(sessionId, { id: sessionId, input, cancelled: false });
    return { sessionId };
  }

  public async *send(sessionId: string, message: string): AsyncIterable<AgentEvent> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    let seq = 1;
    const nowIso = () => new Date().toISOString();
    const roleName = session.input.role.metadata.name;

    yield {
      type: 'started',
      seq: seq++,
      timestamp: nowIso(),
      payload: { provider: 'mock', role: roleName },
    };

    if (session.cancelled) {
      yield { type: 'finished', seq: seq++, timestamp: nowIso(), payload: { status: 'cancelled' } };
      return;
    }

    yield {
      type: 'message_delta',
      seq: seq++,
      timestamp: nowIso(),
      payload: { text: `[Mock Provider] Running simulated turn for role ${roleName}: "${session.input.task.title}"...\n` },
    };

    // Reviewer role simulation
    if (roleName === 'code-reviewer') {
      const isReject = message.includes('REJECT_REVIEW') || message.includes('TODO_FAIL_REVIEW') || message.includes('SYNTAX_ERROR');
      const verdict = isReject ? 'request_changes' : 'approved';
      const summary = isReject
        ? 'Code review rejected: identified defects or unfulfilled acceptance criteria.'
        : 'Code review approved: verified code quality and scope compliance.';

      yield {
        type: 'artifact_emitted',
        seq: seq++,
        timestamp: nowIso(),
        payload: {
          type: 'review_verdict',
          content: {
            verdict,
            summary,
            findings: isReject
              ? [{ file: 'src/index.ts', severity: 'error', message: 'Fails required review criteria' }]
              : [],
            timestamp: nowIso(),
          },
        },
      };

      yield {
        type: 'finished',
        seq: seq++,
        timestamp: nowIso(),
        payload: { status: 'completed', verdict },
      };
      return;
    }

    // Error simulation
    if (session.input.model === 'mock-error') {
      yield {
        type: 'error',
        seq: seq++,
        timestamp: nowIso(),
        payload: { message: 'Simulated task execution failure' },
      };
      yield {
        type: 'finished',
        seq: seq++,
        timestamp: nowIso(),
        payload: { status: 'failed' },
      };
      return;
    }

    // Write file in worktree if permitted
    const cwd = session.input.cwd;
    const targetFile = session.input.task.specPath || 'src/index.ts';
    if (
      cwd &&
      (session.input.role.spec.autonomy === 'workspace-write' ||
        session.input.role.spec.autonomy === 'spec-write' ||
        session.input.role.spec.autonomy === 'test-write' ||
        session.input.role.spec.autonomy === 'full-autonomous')
    ) {
      const fullPath = path.join(cwd, targetFile);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      const hasDefect = session.input.task.title.includes('REJECT_REVIEW') || (session.input.task.description && session.input.task.description.includes('REJECT_REVIEW'));
      const defectNotice = hasDefect ? '// TODO_FAIL_REVIEW defect\n' : '';
      const content = `// Simulated code by MockProvider for task ${session.input.task.id}\n${defectNotice}export const taskId = '${session.input.task.id}';\n`;
      await fs.writeFile(fullPath, content, 'utf-8');

      yield {
        type: 'tool_completed',
        seq: seq++,
        timestamp: nowIso(),
        payload: { tool: 'write_file', target: targetFile, bytesWritten: content.length },
      };
    }

    // Test failure simulation
    let testPassed = true;
    if (session.input.model === 'mock-test-fail') {
      testPassed = false;
      yield {
        type: 'tool_completed',
        seq: seq++,
        timestamp: nowIso(),
        payload: { tool: 'test_runner', exitCode: 1, stderr: 'Tests failed with 1 assertion error' },
      };
    }

    // Budget exceed simulation
    const costUsd = session.input.model === 'mock-exceed-budget' ? 10.0 : 0.0001;

    yield {
      type: 'usage_reported',
      seq: seq++,
      timestamp: nowIso(),
      payload: { tokensPrompt: 100, tokensCompletion: 50, costUsd },
    };

    yield {
      type: 'finished',
      seq: seq++,
      timestamp: nowIso(),
      payload: { status: testPassed ? 'completed' : 'failed' },
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
