import { describe, it, expect } from 'vitest';
import { GeminiProvider } from '@rixed-devos/providers';
import { AgentRole, Task } from '@rixed-devos/domain';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('Gemini 3.8 Flash (High) Primary Provider', () => {
  it('should probe capabilities correctly', async () => {
    const provider = new GeminiProvider();
    const probe = await provider.probe();

    expect(probe.available).toBe(true);
    expect(probe.models).toContain('gemini-3.8-flash-high');
    expect(probe.capabilities).toContain('streaming');
    expect(probe.capabilities).toContain('multi-role-context');
  });

  it('should stream execution events and emit task completion', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'devos-gemini-test-'));
    const provider = new GeminiProvider();

    const role: AgentRole = {
      apiVersion: 'devos/v1',
      kind: 'AgentRole',
      metadata: { name: 'backend-developer', version: '1.0.0', title: 'Backend Developer' },
      spec: {
        purpose: 'Implement backend features',
        compatibleProviders: ['gemini'],
        modelPolicy: { tier: 'high', preferredModel: 'gemini-3.8-flash-high', allowFallback: true },
        autonomy: 'workspace-write',
        permissions: {
          read: ['**/*'],
          write: ['src/**'],
          forbidden: ['.env*'],
          tools: ['file-write'],
          network: 'denied',
          approvalRequired: [],
        },
        skills: ['tdd'],
        review: { requireIndependentReviewer: true, requireAutomatedTests: false },
      },
    };

    const task: Task = {
      id: 'TASK-TEST-1',
      projectId: 'proj-1',
      title: 'Create health endpoint',
      description: 'Add health endpoint returning status ok',
      specPath: 'src/health.ts',
      status: 'RUNNING',
      priority: 'high',
      risk: 'low',
      assigneeRoleId: 'backend-developer',
      writeScope: ['src/**'],
      acceptanceCriteria: ['Returns 200 OK'],
      estimatedBudgetUsd: 1.0,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { sessionId } = await provider.startSession({
      cwd: tempDir,
      role,
      task,
      instructions: task.description,
      baselineCommit: 'HEAD',
      model: 'gemini-3.8-flash-high',
      allowedTools: ['file-write'],
    });

    const receivedEvents: any[] = [];
    for await (const event of provider.send(sessionId, task.title)) {
      receivedEvents.push(event);
    }

    expect(receivedEvents.length).toBeGreaterThan(3);
    expect(receivedEvents[0].type).toBe('started');
    expect(receivedEvents.some(e => e.type === 'tool_completed')).toBe(true);

    const finishEvent = receivedEvents.find(e => e.type === 'finished');
    expect(finishEvent).toBeDefined();
    expect(finishEvent.payload.status).toBe('completed');

    // Verify file was written
    const createdFile = path.join(tempDir, 'src/health.ts');
    const content = await fs.readFile(createdFile, 'utf-8');
    expect(content).toContain('Gemini 3.8 Flash (High)');

    await fs.rm(tempDir, { recursive: true, force: true });
  }, 45000);

  it('should generate independent review verdict for code-reviewer role', async () => {
    const provider = new GeminiProvider();

    const reviewerRole: AgentRole = {
      apiVersion: 'devos/v1',
      kind: 'AgentRole',
      metadata: { name: 'code-reviewer', version: '1.0.0', title: 'Code Reviewer' },
      spec: {
        purpose: 'Independent code review',
        compatibleProviders: ['gemini'],
        modelPolicy: { tier: 'high', preferredModel: 'gemini-3.8-flash-high', allowFallback: true },
        autonomy: 'read-only',
        permissions: { read: ['**/*'], write: [], forbidden: ['*'], tools: [], network: 'denied', approvalRequired: [] },
        skills: [],
        review: { requireIndependentReviewer: false, requireAutomatedTests: false },
      },
    };

    const task: Task = {
      id: 'TASK-TEST-2',
      projectId: 'proj-1',
      title: 'Review PR',
      description: 'Review diff',
      status: 'REVIEW_PENDING',
      priority: 'high',
      risk: 'low',
      assigneeRoleId: 'code-reviewer',
      writeScope: [],
      acceptanceCriteria: [],
      estimatedBudgetUsd: 1.0,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { sessionId } = await provider.startSession({
      cwd: '',
      role: reviewerRole,
      task,
      instructions: 'Review patch',
      baselineCommit: 'HEAD',
      model: 'gemini-3.8-flash-high',
      allowedTools: [],
    });

    const receivedEvents: any[] = [];
    for await (const event of provider.send(sessionId, 'review')) {
      receivedEvents.push(event);
    }

    const artifactEvent = receivedEvents.find(e => e.type === 'artifact_emitted');
    expect(artifactEvent).toBeDefined();
    expect(artifactEvent.payload.content.verdict).toBe('approved');
  });
});
